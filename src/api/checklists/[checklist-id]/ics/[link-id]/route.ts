import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { getChecklistAccess } from "@/src/lib/checklist-access";
import { IcsLinkRecord } from "@/src/types/IcsLinkRecord";

// DELETE /api/tasklist/checklists/:checklistId/ics/:linkId — revoke an ICS feed link (owner only)
export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string; linkId: string },
) {
  const { checklistId, linkId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rm = context.recordManager<IcsLinkRecord>("tasklist", "ics_link");
  const record = await rm.readRecord(linkId);
  if (!record || record.data.checklistId !== checklistId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await rm.deleteRecord(linkId);
  return NextResponse.json({ success: true });
}
