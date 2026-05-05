import fs from "node:fs";
import { createRequire } from "node:module";

// Polyfill require correctly for both ESM (tsx) and CJS (bundle)
// Using a string property access to avoid esbuild warnings about import.meta in CJS output
const _require = (typeof require !== "undefined") 
  ? require 
  : createRequire(import.meta.url);

// Soft-load keytar (native dependency)
let keytar: any = null;
try {
  keytar = _require("keytar");
} catch (e) {
  // Silent; fall back to local .env
}

const SERVICE_NAME = "sintenel-cli";
const KEY_MAP = {
  gemini: "google-ai-api-key",
  openai: "openai-api-key",
  anthropic: "anthropic-api-key"
};
const FALLBACK_ENV = ".env.local";

export type AIProvider = "gemini" | "openai" | "anthropic";

/**
 * Saves the API key to the OS-native credential manager or local .env fallback.
 */
export async function saveApiKey(provider: AIProvider, key: string): Promise<void> {
  const account = KEY_MAP[provider];
  if (keytar) {
    try {
      return await keytar.setPassword(SERVICE_NAME, account, key);
    } catch (e) {}
  }
  
  // Fallback: Store in .env.local
  const envKey = provider === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${provider.toUpperCase()}_API_KEY`;
  let content = "";
  if (fs.existsSync(FALLBACK_ENV)) {
    content = fs.readFileSync(FALLBACK_ENV, "utf8");
    const regex = new RegExp(`${envKey}=.*`, "g");
    if (content.match(regex)) {
      content = content.replace(regex, `${envKey}=${key}`);
    } else {
      content += `\n${envKey}=${key}`;
    }
  } else {
    content = `${envKey}=${key}`;
  }
  fs.writeFileSync(FALLBACK_ENV, content.trim() + "\n", { mode: 0o600 });
}

/**
 * Retrieves the API key from storage.
 */
export async function getApiKey(provider: AIProvider): Promise<string | null> {
  const account = KEY_MAP[provider];
  // 1. Try Keytar
  if (keytar) {
    try {
      const key = await keytar.getPassword(SERVICE_NAME, account);
      if (key) return key;
    } catch (e) {}
  }

  // 2. Try .env.local
  const envKey = provider === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${provider.toUpperCase()}_API_KEY`;
  if (fs.existsSync(FALLBACK_ENV)) {
    const content = fs.readFileSync(FALLBACK_ENV, "utf8");
    const regex = new RegExp(`${envKey}=(.*)`);
    const match = content.match(regex);
    if (match) return match[1].trim();
  }

  // 3. Try process.env
  return process.env[envKey] || null;
}

/**
 * Deletes the API key.
 */
export async function deleteApiKey(provider: AIProvider): Promise<void> {
  const account = KEY_MAP[provider];
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE_NAME, account);
    } catch (e) {}
  }
  
  const envKey = provider === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${provider.toUpperCase()}_API_KEY`;
  if (fs.existsSync(FALLBACK_ENV)) {
    let content = fs.readFileSync(FALLBACK_ENV, "utf8");
    const regex = new RegExp(`${envKey}=.*\n?`, "g");
    content = content.replace(regex, "");
    fs.writeFileSync(FALLBACK_ENV, content.trim() + "\n");
  }
}
