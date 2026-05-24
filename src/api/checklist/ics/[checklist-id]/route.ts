import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { ics } from "@applicator/sdk/utilities";
import { IcsLinkRecord } from "@/src/types/IcsLinkRecord";
import { ChecklistRecord } from "@/src/types/ChecklistRecord";
import { SectionRecord } from "@/src/types/SectionRecord";
import { ItemRecord } from "@/src/types/ItemRecord";
import { resolveReusableDate } from "@/src/lib/reusable-date";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/tasklist/checklist/ics/:checklistId — public ICS feed (authenticated via ?key=)
export async function GET(
  req: NextRequest,
  context: ApiContext,
  params: { checklistId: string },
) {
  const { checklistId } = params;
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return new NextResponse("Forbidden", { status: 403 });

  const tokenHash = crypto.createHash("sha256").update(key).digest("hex");

  const rm = context.recordManager<IcsLinkRecord>("tasklist", "ics_link");
  const result = await rm.readRecords({ fields: { checklistId }, limit: 100 });
  const link = result.records.find((r) => r.data.tokenHash === tokenHash);
  if (!link) return new NextResponse("Forbidden", { status: 403 });

  const checklistsRm = context.recordManager<ChecklistRecord>("tasklist", "checklist");
  const checklist = await checklistsRm.readRecord(checklistId);
  if (!checklist) return new NextResponse("Not Found", { status: 404 });

  const sectionsRm = context.recordManager<SectionRecord>("tasklist", "section");
  const itemsRm = context.recordManager<ItemRecord>("tasklist", "item");

  const [sectionsResult, itemsResult] = await Promise.all([
    sectionsRm.readRecords({ fields: { checklistId }, limit: 500 }),
    itemsRm.readRecords({ fields: { checklistId }, limit: 2000 }),
  ]);

  const sectionNameMap: Record<string, string> = {};
  for (const s of sectionsResult.records) {
    sectionNameMap[s.id] = s.data.name;
  }

  const stamp = ics.icsStamp();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Applicator Tasklist//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ics.icsFoldLine(`X-WR-CALNAME:${ics.icsEscape(checklist.data.name)}`),
  ];

  for (const item of itemsResult.records) {
    const rawDate = item.data.dueDate || "";
    const resolvedDate = ISO_DATE_RE.test(rawDate) ? rawDate : (resolveReusableDate(rawDate) ?? null);
    const status = item.data.complete ? "COMPLETED" : "NEEDS-ACTION";
    const sectionName = item.data.sectionId ? (sectionNameMap[item.data.sectionId] || "") : "";

    lines.push("BEGIN:VTODO");
    lines.push(`UID:item-${item.id}@tasklist.applicator`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(ics.icsFoldLine(`SUMMARY:${ics.icsEscape(item.data.title)}`));
    lines.push(`STATUS:${status}`);
    if (resolvedDate) lines.push(`DUE;VALUE=DATE:${ics.icsDate(resolvedDate, true)}`);
    if (sectionName) lines.push(ics.icsFoldLine(`CATEGORIES:${ics.icsEscape(sectionName)}`));
    lines.push("END:VTODO");
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n") + "\r\n";
  const filename = encodeURIComponent(checklist.data.name) + ".ics";

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
