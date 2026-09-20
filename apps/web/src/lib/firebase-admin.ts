import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function serviceAccount(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

let app: App | null = null;

function getAdminApp(): App | null {
  if (app) return app;
  const sa = serviceAccount();
  if (!sa) return null;
  app =
    getApps().length
      ? getApp()
      : initializeApp({
          credential: cert(sa as Parameters<typeof cert>[0]),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
  return app;
}

export const isAdminConfigured = serviceAccount() !== null;

export function adminAuth(): Auth {
  const a = getAdminApp();
  if (!a) throw new Error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON)");
  return getAuth(a);
}

export function adminDb(): Firestore {
  const a = getAdminApp();
  if (!a) throw new Error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON)");
  return getFirestore(a);
}
