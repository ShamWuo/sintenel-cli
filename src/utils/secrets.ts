import fs from "node:fs";
import { createRequire } from "node:module";

// Polyfill require correctly for both ESM (tsx) and CJS (bundle)
const _require = typeof require !== "undefined"
  ? require
  : createRequire(import.meta?.url || "file://" + process.cwd());

// Soft-load keytar
let keytar: any = null;
try {
  keytar = _require("keytar");
} catch (e) {
  // Silent; fall back to local .env
}

const SERVICE_NAME = "sintenel-cli";
const ACCOUNT_NAME = "google-ai-api-key";
const FALLBACK_ENV = ".env.local";

/**
 * Saves the API key to the OS-native credential manager or local .env fallback.
 */
export async function saveApiKey(key: string): Promise<void> {
  if (keytar) {
    try {
      return await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
    } catch (e) {
      // Fall through to local storage if setPassword fails
    }
  }
  
  // Fallback: Store in .env.local
  fs.writeFileSync(FALLBACK_ENV, `GOOGLE_GENERATIVE_AI_API_KEY=${key}\n`, { mode: 0o600 });
}

/**
 * Retrieves the API key from storage.
 */
export async function getApiKey(): Promise<string | null> {
  // 1. Try Keytar
  if (keytar) {
    try {
      const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (key) return key;
    } catch (e) {}
  }

  // 2. Try .env.local
  if (fs.existsSync(FALLBACK_ENV)) {
    const content = fs.readFileSync(FALLBACK_ENV, "utf8");
    const match = content.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
    if (match) return match[1].trim();
  }

  // 3. Try process.env (for CI/CD or legacy workflows)
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
}

/**
 * Deletes the API key.
 */
export async function deleteApiKey(): Promise<void> {
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    } catch (e) {}
  }
  
  if (fs.existsSync(FALLBACK_ENV)) {
    fs.unlinkSync(FALLBACK_ENV);
  }
}
