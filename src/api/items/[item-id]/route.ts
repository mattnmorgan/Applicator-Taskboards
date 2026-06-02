import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ItemRecord } from "@/src/types/ItemRecord";
import { SubscriptionRecord } from "@/src/types/SubscriptionRecord";
import { getChecklistAccess } from "@/src/lib/checklist-access";

// PATCH /api/tasklist/items/:itemId — update item fields
export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { itemId: string },
) {
  const { itemId } = params;
  const itemManager = context.recordManager<ItemRecord>("tasklist", "item");
  const existing = await itemManager.readRecord(itemId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getChecklistAccess(context, existing.data.checklistId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  // Viewers can only toggle complete on items they are assigned to
  const body = await req.json();
  const isAssignee = existing.data.assigneeId === access.userId;
  const onlyTogglingComplete = Object.keys(body).every((k) => k === "complete" || k === "order");
  if (access.level === "viewer" && !isAssignee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (access.level === "viewer" && !onlyTogglingComplete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only editors and owners can assign users
  if (body.assigneeId !== undefined && access.level === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const updates: Partial<ItemRecord> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.reusable !== undefined) updates.reusable = body.reusable;
    if (body.complete !== undefined) {
      updates.complete = body.complete;
    }
    if (body.order !== undefined) updates.order = body.order;
    if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;
    if (body.sectionId !== undefined) updates.sectionId = body.sectionId;

    const table = await itemManager.getTable();
    const updated = await itemManager.updateRecord(table, itemId, updates);

    // Enrich with assignee name and profile picture
    let assigneeName: string | null = null;
    let assigneePicture: string | null = null;
    if (updated.data.assigneeId) {
      const um = context.recordManager("system", "users");
      const u = await um.readRecord(updated.data.assigneeId) as any;
      if (u) {
        assigneeName = u.data.display_name || u.data.username || null;
        assigneePicture = u.data.icon
          ? `/api/system/assets/icons/users/${updated.data.assigneeId}`
          : null;
      }
    }

    return NextResponse.json({
      id: updated.id,
      ...updated.data,
      assigneeName,
      assigneePicture,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tasklist/items/:itemId — delete an item
export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { itemId: string },
) {
  const { itemId } = params;
  const itemManager = context.recordManager<ItemRecord>("tasklist", "item");
  const existing = await itemManager.readRecord(itemId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getChecklistAccess(context, existing.data.checklistId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Delete any subscriptions for this item
    const subscriptions = context.recordManager<SubscriptionRecord>("tasklist", "subscription");
    const subResult = await subscriptions.readRecords({ fields: { itemId }, limit: 100 });
    if (subResult.records.length > 0) {
      await subscriptions.bulkDeleteRecords(subResult.records.map((r) => r.id));
    }

    await itemManager.deleteRecord(itemId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
