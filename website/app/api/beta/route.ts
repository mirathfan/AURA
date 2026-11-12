import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function appendWithAppsScript(name: string, email: string) {
  const url = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
  const token = process.env.GOOGLE_APPS_SCRIPT_TOKEN;

  if (!url || !token) return false;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, token }),
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`Apps Script returned ${response.status}.`);

  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (result.ok !== true) throw new Error(result.error || "Apps Script rejected the request.");

  return true;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 254) : "";

  if (input.company) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  if (!name || !emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid name and email." }, { status: 400 });
  }

  try {
    if (await appendWithAppsScript(name, email)) {
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const range = process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A:B";

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return NextResponse.json({ error: "Beta signup is temporarily unavailable." }, { status: 503 });
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: [sheetsScope],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const alreadyJoined = existing.data.values?.some(
      (row) => String(row[1] || "").trim().toLowerCase() === email,
    );

    if (!alreadyJoined) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[name, email]] },
      });
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(
      "Unable to append beta signup to Google Sheets",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Unable to save your request right now. Please try again." },
      { status: 500 },
    );
  }
}
