import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { SubscriptionRecord, ItemRecord, getChecklistAccess } from "../_utils";

// POST /api/tasklist/subscriptions — subscribe to a checklist or item
// Body: { checklistId } OR { itemId, checklistId }
export async function POST(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    if (!body.checklistId) {
      return NextResponse.json({ error: "checklistId is required" }, { status: 400 });
    }

    // Verify access to the checklist
    const access = await getChecklistAccess(context, body.checklistId);
    if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

    // If subscribing to an item, verify the item belongs to this checklist
    if (body.itemId) {
      const items = context.recordManager<ItemRecord>("tasklist", "item");
      const item = await items.readRecord(body.itemId);
      if (!item || item.data.checklistId !== body.checklistId) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
    }

    const subscriptions = context.recordManager<SubscriptionRecord>("tasklist", "subscription");

    // Check for existing subscription
    const existing = await subscriptions.readRecords({ fields: { userId: user.id }, limit: 1000 });
    const alreadySubbed = existing.records.find((r) => {
      if (body.itemId) return r.data.itemId === body.itemId;
      return r.data.checklistId === body.checklistId && !r.data.itemId;
    });
    if (alreadySubbed) {
      return NextResponse.json({ id: alreadySubbed.id, ...alreadySubbed.data });
    }

    const table = await subscriptions.getTable();
    const record = await subscriptions.createRecord(table, {
      userId: user.id,
      checklistId: body.checklistId,
      itemId: body.itemId || "",
    });

    return NextResponse.json({ id: record.id, ...record.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
