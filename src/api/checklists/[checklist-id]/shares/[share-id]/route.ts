import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import {
  getChecklistAccess,
  createChecklistShare,
  deleteChecklistShare,
  listChecklistShares,
} from "../../../../_utils";

// PATCH /api/tasklist/checklists/:checklistId/shares/:shareId — update role
// Since contextual authorities are immutable, we delete the old one and create a new one.
export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { checklistId: string; shareId: string },
) {
  const { checklistId, shareId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.role || !["editor", "viewer"].includes(body.role)) {
      return NextResponse.json({ error: "role must be editor or viewer" }, { status: 400 });
    }

    // Find the existing share to get the userId
    const cas = await listChecklistShares(context, checklistId);
    const existing = cas.find((ca: any) => ca.id === shareId);
    if (!existing) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Delete old authority and create new with updated role
    await deleteChecklistShare(context, shareId);
    const updated = await createChecklistShare(
      context,
      checklistId,
      existing.data.user,
      body.role,
      access.userId,
    );

    return NextResponse.json({ id: updated.id, userId: existing.data.user, role: body.role });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tasklist/checklists/:checklistId/shares/:shareId — remove share
export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string; shareId: string },
) {
  const { checklistId, shareId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Verify the share belongs to this checklist before deleting
    const cas = await listChecklistShares(context, checklistId);
    const existing = cas.find((ca: any) => ca.id === shareId);
    if (!existing) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    await deleteChecklistShare(context, shareId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
