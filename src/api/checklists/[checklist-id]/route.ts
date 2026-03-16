import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ChecklistRecord } from "@/src/types/ChecklistRecord";
import { SectionRecord } from "@/src/types/SectionRecord";
import { ItemRecord } from "@/src/types/ItemRecord";
import { SubscriptionRecord } from "@/src/types/SubscriptionRecord";
import { getChecklistAccess, deleteAllChecklistShares } from "@/src/lib/checklist-access";

// GET /api/tasklist/checklists/:checklistId — full checklist with sections, items, and subscription state
export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  const sections = context.recordManager<SectionRecord>("tasklist", "section");
  const items = context.recordManager<ItemRecord>("tasklist", "item");
  const subscriptions = context.recordManager<SubscriptionRecord>("tasklist", "subscription");

  const sectionResult = await sections.readRecords({ fields: { checklistId }, limit: 500 });
  const itemResult = await items.readRecords({ fields: { checklistId }, limit: 2000 });

  // Fetch assignee display names and profile pictures
  const assigneeIds = [...new Set(itemResult.records.map((r) => r.data.assigneeId).filter((id: string | undefined): id is string => !!id))];
  const assigneeNames: Record<string, string> = {};
  const assigneePictures: Record<string, string> = {};
  const userManager = context.recordManager("system", "users");
  for (const uid of assigneeIds) {
    const u = await userManager.readRecord(uid) as any;
    if (u) {
      assigneeNames[uid] = u.data.display_name || u.data.username;
      if (u.data.icon) assigneePictures[uid] = `/api/system/assets/icons/users/${uid}`;
    }
  }

  // Get subscriptions for this user
  const subResult = await subscriptions.readRecords({ fields: { userId: access.userId }, limit: 1000 });
  const checklistSub = subResult.records.find(
    (r) => r.data.checklistId === checklistId && !r.data.itemId,
  );
  const itemSubMap: Record<string, string> = {};
  for (const sub of subResult.records) {
    if (sub.data.itemId) itemSubMap[sub.data.itemId] = sub.id;
  }

  const sortedSections = sectionResult.records.sort((a, b) => a.data.order - b.data.order);

  const sectionsWithItems = sortedSections.map((section) => {
    const sectionItems = itemResult.records
      .filter((i) => i.data.sectionId === section.id)
      .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
      .map((i) => ({
        id: i.id,
        sectionId: i.data.sectionId,
        title: i.data.title,
        assigneeId: i.data.assigneeId || null,
        assigneeName: i.data.assigneeId ? (assigneeNames[i.data.assigneeId] || null) : null,
        assigneePicture: i.data.assigneeId ? (assigneePictures[i.data.assigneeId] || null) : null,
        dueDate: i.data.dueDate || null,
        reusable: !!i.data.reusable,
        complete: !!i.data.complete,
        order: i.data.order ?? 0,
        subscribed: !!itemSubMap[i.id],
        subscriptionId: itemSubMap[i.id] || null,
      }));
    return {
      id: section.id,
      name: section.data.name,
      order: section.data.order,
      items: sectionItems,
    };
  });

  return NextResponse.json({
    id: checklistId,
    name: access.checklist.data.name,
    description: access.checklist.data.description,
    ownerId: access.checklist.data.ownerId,
    currentUserId: access.userId,
    access: access.level,
    subscribed: !!checklistSub,
    subscriptionId: checklistSub?.id || null,
    sections: sectionsWithItems,
  });
}

// PATCH /api/tasklist/checklists/:checklistId — update name or description
export async function PATCH(
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
    const updates: Partial<ChecklistRecord> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description.trim();

    const checklists = context.recordManager<ChecklistRecord>("tasklist", "checklist");
    const table = await checklists.getTable();
    const updated = await checklists.updateRecord(table, checklistId, updates);
    return NextResponse.json({ id: updated.id, ...updated.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tasklist/checklists/:checklistId — delete (owner only)
export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const sections = context.recordManager<SectionRecord>("tasklist", "section");
    const items = context.recordManager<ItemRecord>("tasklist", "item");
    const subscriptions = context.recordManager<SubscriptionRecord>("tasklist", "subscription");

    // Delete all items
    const itemResult = await items.readRecords({ fields: { checklistId }, limit: 5000 });
    if (itemResult.records.length > 0) {
      await items.bulkDeleteRecords(itemResult.records.map((r) => r.id));
    }

    // Delete all sections
    const sectionResult = await sections.readRecords({ fields: { checklistId }, limit: 500 });
    if (sectionResult.records.length > 0) {
      await sections.bulkDeleteRecords(sectionResult.records.map((r) => r.id));
    }

    // Delete all subscriptions for this checklist
    const subResult = await subscriptions.readRecords({ fields: { checklistId }, limit: 1000 });
    if (subResult.records.length > 0) {
      await subscriptions.bulkDeleteRecords(subResult.records.map((r) => r.id));
    }

    // Delete all shares (contextual authorities) for this checklist
    await deleteAllChecklistShares(context, checklistId);

    // Delete the checklist
    const checklists = context.recordManager("tasklist", "checklist");
    await checklists.deleteRecord(checklistId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
