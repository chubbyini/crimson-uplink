import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    node: process.version,
    env: {
      hasFirebaseSa: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      hasTelegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasCronSecret: Boolean(process.env.CRON_SECRET),
      hasFirebaseApiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    },
  });
}
