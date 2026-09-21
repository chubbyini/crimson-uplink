import { NextResponse } from "next/server";

/**
 * GET /api/diag — deployment health check. Reports presence/validity of
 * server configuration WITHOUT ever returning secret values.
 * Gated: requires DIAG_SECRET bearer when set, else same as CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.DIAG_SECRET?.trim()
    ? process.env.DIAG_SECRET.trim()
    : process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const web = {
    apiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
  };
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "";
  let saJsonValid = false;
  let saProject: string | null = null;
  let adminInit: string = "not-attempted";
  if (raw) {
    try {
      const sa = JSON.parse(raw) as { project_id?: string; private_key?: string };
      saJsonValid = true;
      saProject = sa.project_id ?? null;
      const { cert } = await import("firebase-admin/app");
      cert(sa as Parameters<typeof cert>[0]);
      adminInit = "ok";
    } catch {
      adminInit = "failed";
    }
  }

  return NextResponse.json({
    env: {
      hasServiceAccount: raw.length > 0,
      saJsonValid,
      saProject,
      adminInit,
      hasTelegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasCron: Boolean(process.env.CRON_SECRET),
      webConfigured: web.apiKey && Boolean(web.projectId),
      webProjectId: web.projectId,
      node: process.version,
    },
  });
}
