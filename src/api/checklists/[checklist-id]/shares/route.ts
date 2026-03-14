import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import {
  getChecklistAccess,
  createChecklistShare,
  listChecklistShares,
} from "../../../_utils";

// GET /api/tasklist/checklists/:checklistId/shares — list all shares
export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cas = await listChecklistShares(context, checklistId);

  const enriched = await Promise.all(
    cas.map(async (ca: any) => {
      const ctx = ca.data.context ? JSON.parse(ca.data.context) : {};
      const u = await context.user(ca.data.user);
      return {
        id: ca.id,
        userId: ca.data.user,
        displayName: u?.display_name || u?.username || ca.data.user,
        username: u?.username || ca.data.user,
        role: ctx.role as "editor" | "viewer",
      };
    }),
  );

  return NextResponse.json({ shares: enriched });
}

// POST /api/tasklist/checklists/:checklistId/shares — share with a user
export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const access = await getChecklistAccess(context, checklistId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.userId || !body.role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }
    if (!["editor", "viewer"].includes(body.role)) {
      return NextResponse.json({ error: "role must be editor or viewer" }, { status: 400 });
    }
    if (body.userId === access.userId) {
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    // Check for existing share
    const existing = await listChecklistShares(context, checklistId);
    const alreadyShared = existing.find((ca: any) => ca.data.user === body.userId);
    if (alreadyShared) {
      return NextResponse.json({ error: "Already shared with this user" }, { status: 409 });
    }

    const ca = await createChecklistShare(context, checklistId, body.userId, body.role, access.userId);
    const u = await context.user(body.userId);
    return NextResponse.json(
      {
        id: ca.id,
        userId: body.userId,
        displayName: u?.display_name || u?.username || body.userId,
        username: u?.username || body.userId,
        role: body.role,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
