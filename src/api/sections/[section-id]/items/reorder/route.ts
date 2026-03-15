import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SectionRecord } from "@/src/types/SectionRecord";
import { ItemRecord } from "@/src/types/ItemRecord";
import { getChecklistAccess } from "@/src/lib/checklist-access";

// POST /api/tasklist/sections/:sectionId/items/reorder
// Body: { items: [{ id, order }] }
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
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }

    const items = context.recordManager<ItemRecord>("tasklist", "item");
    const table = await items.getTable();

    await Promise.all(
      body.items.map((i: { id: string; order: number }) =>
        items.updateRecord(table, i.id, { order: i.order }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
