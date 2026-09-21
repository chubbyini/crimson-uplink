import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function serviceAccount(): Record<string, unknown> | null {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  raw = raw.trim();
  // Strip potential wrapping single or double quotes from env input
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  // Handle base64-encoded credentials (common in Vercel environment setup)
  if (!raw.startsWith("{") && !raw.startsWith("[")) {
    try {
      raw = Buffer.from(raw, "base64").toString("utf8").trim();
    } catch {
      // not base64
    }
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Handle escaped newlines in private key if present
    if (typeof parsed.private_key === "string" && parsed.private_key.includes("\\n")) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", err);
    return null;
  }
}

let app: App | null = null;
let firestoreDb: Firestore | null = null;

function getAdminApp(): App | null {
  if (app) return app;
  const sa = serviceAccount();
  if (!sa) return null;
  try {
    app =
      getApps().length
        ? getApp()
        : initializeApp({
            credential: cert(sa as Parameters<typeof cert>[0]),
            projectId:
              (sa.project_id as string) ||
              process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          });
    return app;
  } catch (err) {
    console.error("Failed to initialize Firebase Admin App:", err);
    return null;
  }
}

export const isAdminConfigured = serviceAccount() !== null;

let authInstance: Auth | null = null;

export function adminAuth(): Auth {
  if (authInstance) return authInstance;
  const a = getAdminApp();
  if (!a) throw new Error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON)");
  authInstance = getAuth(a);
  return authInstance;
}

export function adminDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  const a = getAdminApp();
  if (!a) throw new Error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON)");
  const db = getFirestore(a);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // ignore if settings already applied
  }
  firestoreDb = db;
  return firestoreDb;
}

/**
 * Resilient ID token verification:
 * 1. Attempts adminAuth().verifyIdToken()
 * 2. If it fails due to Node ESM/CJS packaging issues, uses Google's Identity Toolkit REST API
 */
export async function verifyFirebaseToken(token: string): Promise<string> {
  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    // Fallback: Verify via Google Identity Toolkit REST API
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: token }),
            signal: AbortSignal.timeout(6000),
          }
        );
        if (res.ok) {
          const data = (await res.json()) as { users?: Array<{ localId: string }> };
          const uid = data.users?.[0]?.localId;
          if (uid) return uid;
        }
      } catch (fallbackErr) {
        console.error("REST token verification fallback failed:", fallbackErr);
      }
    }
    throw err;
  }
}
