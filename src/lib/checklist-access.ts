import { ApiContext } from "@applicator/sdk/context";
import { ChecklistRecord } from "@/src/types/ChecklistRecord";

export type AccessLevel = "owner" | "editor" | "viewer";

function checklistRecordId(checklistId: string) {
  return `checklist-${checklistId}`;
}

function sharePermission(role: "editor" | "viewer") {
  return role === "editor" ? "tasklist:checklist-editor" : "tasklist:checklist-viewer";
}

/**
 * Returns the access level of the current user for a checklist, or null if no access.
 * Owners are identified by the ownerId field; shared access is managed via
 * contextual authorities (user-scoped, keyed by checklist ID).
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

  const caManager = (context as any).contextualAuthorityManager;
  const cas = await caManager.getContextualAuthorities("tasklist", checklistRecordId(checklistId));
  const userCA = cas.find((ca: any) => ca.data.user === user.id);

  if (userCA) {
    const ctx = userCA.data.context ? JSON.parse(userCA.data.context) : {};
    return {
      level: ctx.role as "editor" | "viewer",
      userId: user.id,
      checklist: checklist as { id: string; data: ChecklistRecord },
    };
  }

  return null;
}

/**
 * Creates a user-scoped contextual authority granting a user access to a checklist.
 * The role ("editor" or "viewer") is stored in the authority's context field.
 */
export async function createChecklistShare(
  context: ApiContext,
  checklistId: string,
  userId: string,
  role: "editor" | "viewer",
  createdBy: string,
) {
  const caManager = (context as any).contextualAuthorityManager;
  return caManager.createUserContextualAuthority({
    app: "tasklist",
    recordId: checklistRecordId(checklistId),
    permission: sharePermission(role),
    user: userId,
    createdBy,
    context: JSON.stringify({ role }),
  });
}

/**
 * Lists all contextual authorities for a checklist (i.e., all shares).
 */
export async function listChecklistShares(context: ApiContext, checklistId: string) {
  const caManager = (context as any).contextualAuthorityManager;
  return caManager.getContextualAuthorities("tasklist", checklistRecordId(checklistId));
}

/**
 * Deletes all contextual authorities for a checklist (used when deleting a checklist).
 */
export async function deleteAllChecklistShares(context: ApiContext, checklistId: string) {
  const cas = await listChecklistShares(context, checklistId);
  const caManager = (context as any).contextualAuthorityManager;
  await Promise.all(cas.map((ca: any) => caManager.deleteContextualAuthority(ca.id)));
}

/**
 * Deletes a contextual authority by its full ID.
 */
export async function deleteChecklistShare(context: ApiContext, shareId: string) {
  const caManager = (context as any).contextualAuthorityManager;
  return caManager.deleteContextualAuthority(shareId);
}
