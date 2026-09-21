import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/** Get the 32-byte master encryption key. Fail CLOSED when unset. */
function getMasterKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.trim() === "") {
    throw new Error(
      "ENCRYPTION_KEY is not set — refusing to encrypt with a fallback key. " +
        "See apps/web/.env.example."
    );
  }
  return crypto.createHash("sha256").update(envKey.trim()).digest();
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

/** Decrypt a sensitive text string using AES-256-GCM (backward-compatible with legacy unencrypted keys). */
export function decryptField(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith("enc:")) {
    return ciphertext || ""; // Backward compatibility for legacy unencrypted plaintext keys
  }

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 4) {
      throw new Error(`Invalid ciphertext format: expected 4 colon-separated parts, got ${parts.length}`);
    }

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
    const errMessage = e instanceof Error ? e.message : String(e);
    console.error(`[CRYPTO ERROR] Decryption failed for payload "${ciphertext.slice(0, 20)}...": ${errMessage}`);
    throw new Error(`[CRYPTO ERROR] Secret decryption failed: ${errMessage}`);
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
      try {
        (result as Record<string, unknown>)[field] = decryptField(result[field] as string);
      } catch (e) {
        // Loud but non-fatal: keep the original ciphertext so a single corrupt
        // field can't 500 every route (loadSettings feeds all of them), and a
        // later re-save re-encrypts cleanly (encryptField passes enc: through).
        console.error(
          `[CRYPTO ERROR] Skipping undecryptable field "${field}": ${e instanceof Error ? e.message : e}`
        );
      }
    }
  }
  return result as T;
}

/** Return a copy of settings with secret fields masked for client API responses. */
export function maskSettingsSecrets<T extends Record<string, unknown>>(settings: T): T {
  const result = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (typeof result[field] === "string" && result[field]) {
      try {
        const plain = decryptField(result[field] as string);
        (result as Record<string, unknown>)[field] = maskSecret(plain);
      } catch (e) {
        // Never fail a read over one bad field — mask it and shout instead.
        console.error(
          `[CRYPTO ERROR] Masking undecryptable field "${field}": ${e instanceof Error ? e.message : e}`
        );
        (result as Record<string, unknown>)[field] = "••••••••";
      }
    }
  }
  return result as T;
}

