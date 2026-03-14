import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SectionRecord, getChecklistAccess } from "../../../_utils";

// POST /api/tasklist/checklists/:checklistId/sections — add a section
export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const sections = context.recordManager<SectionRecord>("tasklist", "section");

    // Determine max order
    const existing = await sections.readRecords({ fields: { checklistId }, limit: 500 });
    const maxOrder = existing.records.reduce((m, r) => Math.max(m, r.data.order ?? 0), -1);

    const table = await sections.getTable();
    const record = await sections.createRecord(table, {
      checklistId,
      name: body.name?.trim() || "New Section",
      order: maxOrder + 1,
    });

    return NextResponse.json({ id: record.id, ...record.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
