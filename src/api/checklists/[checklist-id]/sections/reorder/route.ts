import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SectionRecord } from "@/src/types/SectionRecord";
import { getChecklistAccess } from "@/src/lib/checklist-access";

// POST /api/tasklist/checklists/:checklistId/sections/reorder
// Body: { sections: [{ id, order }] }
export async function POST(
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
    if (!Array.isArray(body.sections)) {
      return NextResponse.json({ error: "sections array required" }, { status: 400 });
    }

    const sectionManager = context.recordManager<SectionRecord>("tasklist", "section");
    const table = await sectionManager.getTable();

    for (const s of body.sections as { id: string; order: number }[]) {
      await sectionManager.updateRecord(table, s.id, { order: s.order });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
