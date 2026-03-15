import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SubscriptionRecord } from "@/src/types/SubscriptionRecord";

// DELETE /api/tasklist/subscriptions/:subscriptionId — unsubscribe
export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { subscriptionId: string },
) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { subscriptionId } = params;
    const subscriptions = context.recordManager<SubscriptionRecord>("tasklist", "subscription");
    const existing = await subscriptions.readRecord(subscriptionId);

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.data.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await subscriptions.deleteRecord(subscriptionId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
