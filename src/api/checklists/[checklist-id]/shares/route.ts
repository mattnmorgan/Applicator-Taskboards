import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ShareRecord, getChecklistAccess } from "../../../_utils";

// GET /api/tasklist/checklists/:checklistId/shares — list all shares
export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const shares = context.recordManager<ShareRecord>("tasklist", "share");
  const result = await shares.readRecords({ fields: { checklistId }, limit: 500 });

  const enriched = await Promise.all(
    result.records.map(async (r) => {
      const u = await context.user(r.data.userId);
      return {
        id: r.id,
        userId: r.data.userId,
        displayName: u?.display_name || u?.username || r.data.userId,
        username: u?.username || r.data.userId,
        role: r.data.role,
      };
    }),
  );

  return NextResponse.json({ shares: enriched });
}

// POST /api/tasklist/checklists/:checklistId/shares — share with a user
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
    if (!body.userId || !body.role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }
    if (!["editor", "viewer"].includes(body.role)) {
      return NextResponse.json({ error: "role must be editor or viewer" }, { status: 400 });
    }

    // Prevent sharing with self
    if (body.userId === access.userId) {
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    const shares = context.recordManager<ShareRecord>("tasklist", "share");

    // Check for existing share
    const existing = await shares.readRecords({ fields: { checklistId }, limit: 500 });
    const alreadyShared = existing.records.find((r) => r.data.userId === body.userId);
    if (alreadyShared) {
      return NextResponse.json({ error: "Already shared with this user" }, { status: 409 });
    }

    const table = await shares.getTable();
    const record = await shares.createRecord(table, {
      checklistId,
      userId: body.userId,
      role: body.role,
    });

    const u = await context.user(body.userId);
    return NextResponse.json(
      {
        id: record.id,
        userId: record.data.userId,
        displayName: u?.display_name || u?.username || body.userId,
        username: u?.username || body.userId,
        role: record.data.role,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
