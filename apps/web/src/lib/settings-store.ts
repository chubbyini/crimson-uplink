import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SettingsSchema, type Settings } from "@/lib/settings";

export function settingsRef(uid: string) {
  if (!db) throw new Error("Firestore is not configured");
  return doc(db, "users", uid, "settings", "config");
}

export async function getSettings(uid: string): Promise<Settings | null> {
  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) return null;
  return SettingsSchema.parse({ ...snap.data() });
}

export async function saveSettings(uid: string, settings: Settings) {
  const parsed = SettingsSchema.parse(settings);
  await setDoc(
    settingsRef(uid),
    { ...parsed, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return parsed;
}
