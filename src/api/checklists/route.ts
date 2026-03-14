import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ChecklistRecord, ShareRecord } from "../_utils";

// GET /api/tasklist/checklists — list checklists owned by or shared with the current user
export async function GET(_req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checklists = context.recordManager<ChecklistRecord>("tasklist", "checklist");
  const shares = context.recordManager<ShareRecord>("tasklist", "share");

  const ownedResult = await checklists.readRecords({ fields: { ownerId: user.id }, limit: 500 });

  const sharedResult = await shares.readRecords({ fields: { userId: user.id }, limit: 500 });
  const sharedChecklistIds = sharedResult.records.map((r) => r.data.checklistId);

  const sharedChecklists: { id: string; name: string; description: string; ownerId: string; role: string }[] = [];
  for (const shareRecord of sharedResult.records) {
    const cl = await checklists.readRecord(shareRecord.data.checklistId);
    if (cl) {
      sharedChecklists.push({
        id: cl.id,
        name: cl.data.name,
        description: cl.data.description,
        ownerId: cl.data.ownerId,
        role: shareRecord.data.role,
      });
    }
  }

  return NextResponse.json({
    owned: ownedResult.records.map((r) => ({
      id: r.id,
      name: r.data.name,
      description: r.data.description,
      ownerId: r.data.ownerId,
      role: "owner",
    })),
    shared: sharedChecklists,
  });
}

// POST /api/tasklist/checklists — create a new checklist
export async function POST(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const checklists = context.recordManager<ChecklistRecord>("tasklist", "checklist");
    const table = await checklists.getTable();
    const record = await checklists.createRecord(table, {
      name: body.name.trim(),
      description: body.description?.trim() || "",
      ownerId: user.id,
    });

    return NextResponse.json({ id: record.id, ...record.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
