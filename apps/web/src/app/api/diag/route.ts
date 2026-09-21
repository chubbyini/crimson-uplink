import { NextResponse } from "next/server";

/**
 * GET /api/diag — deployment health check. Reports presence/validity of
 * server configuration WITHOUT ever returning secret values.
 */
export async function GET() {
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
    } catch (e) {
      adminInit = e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "failed";
    }
  }

  return NextResponse.json({
    env: {
      hasServiceAccount: raw.length > 0,
      saLen: raw.length,
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
