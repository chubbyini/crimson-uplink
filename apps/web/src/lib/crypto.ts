import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/** Get or derive a 32-byte master encryption key. */
function getMasterKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY || process.env.FIREBASE_PROJECT_ID || "crimson-uplink-secret-key-default-salt-2026";
  return crypto.createHash("sha256").update(envKey).digest();
}

/** Encrypt a sensitive text string using AES-256-GCM. */
export function encryptField(plaintext: string): string {
  if (!plaintext || plaintext.trim() === "") return "";
  if (plaintext.startsWith("enc:")) return plaintext; // Already encrypted

  const iv = crypto.randomBytes(12);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/** Decrypt a sensitive text string using AES-256-GCM (backward-compatible with plaintext). */
export function decryptField(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith("enc:")) {
    return ciphertext || ""; // Backward compatibility for legacy plaintext keys
  }

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 4) return ciphertext;

    const [, ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    console.error("Decryption failed:", e);
    return "";
  }
}

const SECRET_FIELDS = ["geminiKey", "groqKey", "devtoKey", "linkedinToken", "githubToken"] as const;

/** Mask a secret string so it never exposes full plaintext over HTTP. */
export function maskSecret(secret: string): string {
  if (!secret || secret.trim() === "") return "";
  const s = secret.trim();
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
}

/** Check if a string is a masked secret indicator. */
export function isMaskedSecret(str: string): boolean {
  return typeof str === "string" && str.includes("••••");
}

/** Encrypt all secret API key fields in a settings object. */
export function encryptSettingsSecrets<T extends Record<string, unknown>>(settings: T): T {
  const result = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field] = encryptField(result[field] as string);
    }
  }
  return result as T;
}

/** Decrypt all secret API key fields in a settings object. */
export function decryptSettingsSecrets<T extends Record<string, unknown>>(settings: T): T {
  const result = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field] = decryptField(result[field] as string);
    }
  }
  return result as T;
}

/** Return a copy of settings with secret fields masked for client API responses. */
export function maskSettingsSecrets<T extends Record<string, unknown>>(settings: T): T {
  const result = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (typeof result[field] === "string" && result[field]) {
      const plain = decryptField(result[field] as string);
      (result as Record<string, unknown>)[field] = maskSecret(plain);
    }
  }
  return result as T;
}

