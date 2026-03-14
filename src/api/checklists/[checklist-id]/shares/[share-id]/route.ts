import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ShareRecord, getChecklistAccess } from "../../../../_utils";

// PATCH /api/tasklist/checklists/:checklistId/shares/:shareId — update role
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

    const shares = context.recordManager<ShareRecord>("tasklist", "share");
    const existing = await shares.readRecord(shareId);
    if (!existing || existing.data.checklistId !== checklistId) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    const table = await shares.getTable();
    const updated = await shares.updateRecord(table, shareId, { role: body.role });
    return NextResponse.json({ id: updated.id, ...updated.data });
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
    const shares = context.recordManager<ShareRecord>("tasklist", "share");
    const existing = await shares.readRecord(shareId);
    if (!existing || existing.data.checklistId !== checklistId) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    await shares.deleteRecord(shareId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
