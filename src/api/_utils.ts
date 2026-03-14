import { ApiContext } from "@applicator/sdk/context";

export type AccessLevel = "owner" | "editor" | "viewer";

export interface ChecklistRecord {
  name: string;
  description: string;
  ownerId: string;
}

export interface SectionRecord {
  checklistId: string;
  name: string;
  order: number;
}

export interface ItemRecord {
  sectionId: string;
  checklistId: string;
  title: string;
  assigneeId: string;
  dueDate: string;
  reusable: boolean;
  complete: boolean;
  order: number;
}

export interface ShareRecord {
  checklistId: string;
  userId: string;
  role: string;
}

export interface SubscriptionRecord {
  userId: string;
  checklistId: string;
  itemId: string;
}

/**
 * Returns the access level of the current user for a checklist, or null if no access.
 * Also returns the checklist record and the current user ID.
 */
export async function getChecklistAccess(
  context: ApiContext,
  checklistId: string,
): Promise<{ level: AccessLevel; userId: string; checklist: { id: string; data: ChecklistRecord } } | null> {
  const user = await context.user();
  if (!user) return null;

  const checklists = context.recordManager<ChecklistRecord>("tasklist", "checklist");
  const checklist = await checklists.readRecord(checklistId);
  if (!checklist) return null;

  if (checklist.data.ownerId === user.id) {
    return { level: "owner", userId: user.id, checklist: checklist as { id: string; data: ChecklistRecord } };
  }

  const shares = context.recordManager<ShareRecord>("tasklist", "share");
  const result = await shares.readRecords({ fields: { checklistId }, limit: 500 });
  const userShare = result.records.find((r) => r.data.userId === user.id);

  if (userShare) {
    return {
      level: userShare.data.role as "editor" | "viewer",
      userId: user.id,
      checklist: checklist as { id: string; data: ChecklistRecord },
    };
  }

  return null;
}
