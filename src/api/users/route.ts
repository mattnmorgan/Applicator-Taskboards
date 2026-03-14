import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";

// GET /api/tasklist/users — list active system users for assignee selection
export async function GET(_req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userManager = context.recordManager("system", "users");
  const result = await userManager.readRecords({
    filters: [{ field: "active", operator: "=", value: true }],
    limit: 500,
  });

  return NextResponse.json({
    users: result.records.map((r: any) => ({
      id: r.id,
      username: r.data.username,
      displayName: r.data.display_name || r.data.username,
    })),
  });
}
