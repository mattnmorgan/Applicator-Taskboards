import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ChecklistRecord } from "@/src/types/ChecklistRecord";

// GET /api/tasklist/checklists — list checklists owned by or shared with the current user
export async function GET(_req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checklists = context.recordManager<ChecklistRecord>("tasklist", "checklist");

  const ownedResult = await checklists.readRecords({ fields: { ownerId: user.id }, limit: 500 });

  // Discover checklists shared with this user via contextual authorities.
  // Query CAs where user = current user and app = "tasklist".
  const caManager = (context as any).contextualAuthorityManager;
  const userCAsResult = await caManager.readRecords({ fields: { user: user.id, app: "tasklist" } });
  const userCAs = userCAsResult.records;

  const sharedChecklists: { id: string; name: string; description: string; ownerId: string; role: string }[] = [];
  for (const ca of userCAs) {
    const ctx = ca.data.context ? JSON.parse(ca.data.context) : {};
    // CA id format: "tasklist:checklist-{checklistId}:user:{userId}"
    const idMatch = ca.id.match(/^tasklist:checklist-(.+):user:/);
    const checklistId = idMatch?.[1];
    if (!checklistId) continue;
    const cl = await checklists.readRecord(checklistId);
    if (cl) {
      sharedChecklists.push({
        id: cl.id,
        name: cl.data.name,
        description: cl.data.description,
        ownerId: cl.data.ownerId,
        role: ctx.role,
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
