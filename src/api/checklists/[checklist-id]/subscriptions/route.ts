import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SubscriptionRecord } from "@/src/types/SubscriptionRecord";
import { getChecklistAccess } from "@/src/lib/checklist-access";

// GET /api/tasklist/checklists/:checklistId/subscriptions
// Returns the current user's subscription state for this checklist and all its items
export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  const subscriptions = context.recordManager<SubscriptionRecord>("tasklist", "subscription");
  const result = await subscriptions.readRecords({ fields: { userId: access.userId }, limit: 1000 });

  const checklistSub = result.records.find(
    (r) => r.data.checklistId === checklistId && !r.data.itemId,
  );
  const itemSubMap: Record<string, string> = {};
  for (const sub of result.records) {
    if (sub.data.itemId) itemSubMap[sub.data.itemId] = sub.id;
  }

  return NextResponse.json({
    checklistSubscriptionId: checklistSub?.id || null,
    subscribed: !!checklistSub,
    itemSubscriptions: itemSubMap,
  });
}
