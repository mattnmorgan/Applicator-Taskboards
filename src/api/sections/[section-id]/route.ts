import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SectionRecord } from "@/src/types/SectionRecord";
import { ItemRecord } from "@/src/types/ItemRecord";
import { SubscriptionRecord } from "@/src/types/SubscriptionRecord";
import { getChecklistAccess } from "@/src/lib/checklist-access";

// PATCH /api/tasklist/sections/:sectionId — rename a section
export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { sectionId: string },
) {
  const { sectionId } = params;
  const sections = context.recordManager<SectionRecord>("tasklist", "section");
  const section = await sections.readRecord(sectionId);
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getChecklistAccess(context, section.data.checklistId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const updates: Partial<SectionRecord> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.order !== undefined) updates.order = body.order;

    const table = await sections.getTable();
    const updated = await sections.updateRecord(table, sectionId, updates);
    return NextResponse.json({ id: updated.id, ...updated.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tasklist/sections/:sectionId — delete section and its items
export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { sectionId: string },
) {
  const { sectionId } = params;
  const sections = context.recordManager<SectionRecord>("tasklist", "section");
  const section = await sections.readRecord(sectionId);
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getChecklistAccess(context, section.data.checklistId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const items = context.recordManager<ItemRecord>("tasklist", "item");
    const subscriptions = context.recordManager<SubscriptionRecord>("tasklist", "subscription");

    const itemResult = await items.readRecords({ fields: { sectionId }, limit: 2000 });

    // Delete subscriptions for all items in this section
    for (const item of itemResult.records) {
      const subResult = await subscriptions.readRecords({ fields: { itemId: item.id }, limit: 100 });
      if (subResult.records.length > 0) {
        await subscriptions.bulkDeleteRecords(subResult.records.map((r) => r.id));
      }
    }

    // Delete items
    if (itemResult.records.length > 0) {
      await items.bulkDeleteRecords(itemResult.records.map((r) => r.id));
    }

    // Delete section
    await sections.deleteRecord(sectionId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
