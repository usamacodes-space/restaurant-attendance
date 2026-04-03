import { google } from "googleapis";
import {
  attendanceExportColumnOrder,
  type NormalizedAttendanceLogRow,
  toAttendanceExportRow,
} from "@/lib/attendance-logs-data";

/** Accepts raw ID or full `https://docs.google.com/spreadsheets/d/{id}/...` URL */
export function parseSpreadsheetId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1] ?? null;
  if (/^[a-zA-Z0-9-_]+$/.test(t)) return t;
  return null;
}

function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }
  const credentials = JSON.parse(raw) as Record<string, unknown>;
  if (typeof credentials.client_email !== "string" || typeof credentials.private_key !== "string") {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function a1SheetRange(tabName: string, range: string): string {
  const escaped = tabName.replace(/'/g, "''");
  const quoted = `'${escaped}'`;
  return `${quoted}!${range}`;
}

async function ensureTabExists(spreadsheetId: string, title: string) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
}

/**
 * Replaces the tab contents with a header row + one row per log (no image URLs).
 */
export async function replaceAttendanceSheetTab(
  spreadsheetId: string,
  tabName: string,
  rows: NormalizedAttendanceLogRow[]
) {
  const sheets = getSheetsClient();
  const title = tabName.trim() || "Attendance";
  await ensureTabExists(spreadsheetId, title);

  const exportObjects = rows.map((r) => toAttendanceExportRow(r));
  const header = [...attendanceExportColumnOrder];
  const body = exportObjects.map((obj) =>
    attendanceExportColumnOrder.map((k) => {
      const v = obj[k];
      if (v === null || v === undefined) return "";
      return typeof v === "number" ? v : String(v);
    })
  );
  const values = [header, ...body];

  const rangeAll = a1SheetRange(title, "A:ZZ");

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: rangeAll,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1SheetRange(title, "A1"),
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
