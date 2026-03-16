import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ItemRecord } from "@/src/types/ItemRecord";
import { SectionRecord } from "@/src/types/SectionRecord";
import { getChecklistAccess } from "@/src/lib/checklist-access";

type ItemRec = { id: string; data: ItemRecord };
type SectionRec = { id: string; data: SectionRecord };

// GET /api/tasklist/widget/:checklistId?lookahead=24|48|72|168|none
export async function GET(
  req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  const lookahead = req.nextUrl.searchParams.get("lookahead") || "none";

  const itemsManager = context.recordManager<ItemRecord>("tasklist", "item");
  const sectionsManager = context.recordManager<SectionRecord>("tasklist", "section");

  const [itemResult, sectionResult] = await Promise.all([
    itemsManager.readRecords({ fields: { checklistId }, limit: 2000 }),
    sectionsManager.readRecords({ fields: { checklistId }, limit: 200 }),
  ]);

  const now = Date.now();
  const lookaheadMs = lookahead === "none" ? null : parseInt(lookahead, 10) * 60 * 60 * 1000;
  const cutoffMs = lookaheadMs ? now + lookaheadMs : null;

  const filtered = (itemResult.records as ItemRec[])
    .filter((r: ItemRec) => {
      if (r.data.complete) return false;
      if (!cutoffMs) return true;
      if (r.data.reusable) return true;
      if (!r.data.dueDate) return true;
      const dueMs = new Date(r.data.dueDate).getTime();
      if (isNaN(dueMs)) return true;
      return dueMs <= cutoffMs;
    })
    .sort((a: ItemRec, b: ItemRec) => (a.data.order ?? 0) - (b.data.order ?? 0));

  // Enrich with assignee names and profile pictures
  const assigneeIds = [...new Set(filtered.map((r: ItemRec) => r.data.assigneeId).filter((id): id is string => !!id))];
  const assigneeNames: Record<string, string> = {};
  const assigneePictures: Record<string, string> = {};
  const userMgr = context.recordManager("system", "users");
  for (const uid of assigneeIds) {
    const u = await userMgr.readRecord(uid) as any;
    if (u) {
      assigneeNames[uid] = u.data.display_name || u.data.username;
      if (u.data.icon) assigneePictures[uid] = `/api/system/assets/icons/users/${uid}`;
    }
  }

  // Sort sections by order
  const sortedSections = (sectionResult.records as SectionRec[])
    .sort((a: SectionRec, b: SectionRec) => (a.data.order ?? 0) - (b.data.order ?? 0));

  // Group items by sectionId
  const itemsBySection: Record<string, ItemRec[]> = {};
  for (const r of filtered) {
    const sid = r.data.sectionId;
    if (!itemsBySection[sid]) itemsBySection[sid] = [];
    itemsBySection[sid].push(r);
  }

  const sections = sortedSections
    .map((s: SectionRec) => ({
      id: s.id,
      name: s.data.name,
      items: (itemsBySection[s.id] || []).map((r: ItemRec) => ({
        id: r.id,
        title: r.data.title,
        assigneeId: r.data.assigneeId || null,
        assigneeName: r.data.assigneeId ? (assigneeNames[r.data.assigneeId] || null) : null,
        assigneePicture: r.data.assigneeId ? (assigneePictures[r.data.assigneeId] || null) : null,
        dueDate: r.data.dueDate || null,
        reusable: !!r.data.reusable,
        complete: !!r.data.complete,
      })),
    }))
    .filter((s) => s.items.length > 0);

  return NextResponse.json({
    checklistName: access.checklist.data.name,
    accessLevel: access.level,
    currentUserId: access.userId,
    sections,
  });
}
