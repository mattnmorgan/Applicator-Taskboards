import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ItemRecord } from "@/src/types/ItemRecord";
import { getChecklistAccess } from "@/src/lib/checklist-access";

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

  const items = context.recordManager<ItemRecord>("tasklist", "item");
  const result = await items.readRecords({ fields: { checklistId }, limit: 2000 });

  const now = Date.now();
  const lookaheadMs = lookahead === "none" ? null : parseInt(lookahead, 10) * 60 * 60 * 1000;
  const cutoffMs = lookaheadMs ? now + lookaheadMs : null;

  const filtered = result.records
    .filter((r) => {
      // Always exclude completed non-reusable items
      if (r.data.complete && !r.data.reusable) return false;
      if (!cutoffMs) return true; // "none" = show all incomplete/reusable

      // For reusable items with custom text dates, always show
      if (r.data.reusable) return true;

      // For normal items, filter by due date
      if (!r.data.dueDate) return true; // no due date — always show
      const dueMs = new Date(r.data.dueDate).getTime();
      if (isNaN(dueMs)) return true;
      return dueMs <= cutoffMs;
    })
    .sort((a, b) => {
      // Sort by due date ascending, then by order
      const da = a.data.dueDate && !a.data.reusable ? new Date(a.data.dueDate).getTime() : Infinity;
      const db = b.data.dueDate && !b.data.reusable ? new Date(b.data.dueDate).getTime() : Infinity;
      if (da !== db) return da - db;
      return (a.data.order ?? 0) - (b.data.order ?? 0);
    });

  // Enrich with assignee names
  const assigneeIds = [...new Set(filtered.map((r) => r.data.assigneeId).filter(Boolean))];
  const assigneeNames: Record<string, string> = {};
  for (const uid of assigneeIds) {
    const u = await context.user(uid);
    if (u) assigneeNames[uid] = u.display_name || u.username;
  }

  return NextResponse.json({
    checklistName: access.checklist.data.name,
    items: filtered.map((r) => ({
      id: r.id,
      title: r.data.title,
      assigneeId: r.data.assigneeId || null,
      assigneeName: r.data.assigneeId ? (assigneeNames[r.data.assigneeId] || null) : null,
      dueDate: r.data.dueDate || null,
      reusable: !!r.data.reusable,
      complete: !!r.data.complete,
    })),
  });
}
