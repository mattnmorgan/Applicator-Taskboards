import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SectionRecord, ItemRecord, getChecklistAccess } from "../../../_utils";

// POST /api/tasklist/sections/:sectionId/items — add an item to a section
export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { sectionId: string },
) {
  const { sectionId } = params;
  const sections = context.recordManager<SectionRecord>("tasklist", "section");
  const section = await sections.readRecord(sectionId);
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const access = await getChecklistAccess(context, section.data.checklistId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const items = context.recordManager<ItemRecord>("tasklist", "item");

    // Determine max order among incomplete items in this section
    const existing = await items.readRecords({ fields: { sectionId }, limit: 2000 });
    const incompleteItems = existing.records.filter((r) => !r.data.complete);
    const maxOrder = incompleteItems.reduce((m, r) => Math.max(m, r.data.order ?? 0), -1);

    const table = await items.getTable();
    const record = await items.createRecord(table, {
      sectionId,
      checklistId: section.data.checklistId,
      title: body.title.trim(),
      assigneeId: body.assigneeId || "",
      dueDate: body.dueDate || "",
      reusable: false,
      complete: false,
      order: maxOrder + 1,
    });

    return NextResponse.json({ id: record.id, ...record.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
