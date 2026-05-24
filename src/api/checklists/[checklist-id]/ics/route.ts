import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { getChecklistAccess } from "@/src/lib/checklist-access";
import { IcsLinkRecord } from "@/src/types/IcsLinkRecord";

// GET /api/tasklist/checklists/:checklistId/ics — list ICS feed links (owner only)
export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rm = context.recordManager<IcsLinkRecord>("tasklist", "ics_link");
  const result = await rm.readRecords({ fields: { checklistId }, limit: 100 });

  const userMgr = context.recordManager("system", "users");
  const links = await Promise.all(
    result.records.map(async (r) => {
      const creator = await userMgr.readRecord(r.data.createdBy) as any;
      return {
        id: r.id,
        name: r.data.name,
        description: r.data.description || "",
        createdAt: r.data.createdAt,
        createdBy: r.data.createdBy,
        creatorName: creator?.data.display_name || creator?.data.username || r.data.createdBy,
      };
    }),
  );

  return NextResponse.json({ links });
}

// POST /api/tasklist/checklists/:checklistId/ics — create an ICS feed link (owner only)
export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const rm = context.recordManager<IcsLinkRecord>("tasklist", "ics_link");
    const table = await rm.getTable();
    const record = await rm.createRecord(table, {
      checklistId,
      name,
      description: (body.description || "").trim(),
      tokenHash,
      createdBy: access.userId,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        id: record.id,
        name: record.data.name,
        description: record.data.description || "",
        createdAt: record.data.createdAt,
        token, // plaintext — only returned here, not stored
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
