import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "MISSING",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "MISSING",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "MISSING",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "MISSING",
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "MISSING" &&
  firebaseConfig.projectId !== "MISSING" &&
  firebaseConfig.appId !== "MISSING";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
