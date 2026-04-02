import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const keytar = require("keytar");

const SERVICE_NAME = "sintenel-cli";
const ACCOUNT_NAME = "google-ai-api-key";

/**
 * Saves the API key to the OS-native credential manager (Keychain/Windows Credential Manager).
 */
export async function saveApiKey(key: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
}

/**
 * Retrieves the API key from the OS-native credential manager.
 */
export async function getApiKey(): Promise<string | null> {
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
}

/**
 * Deletes the API key from the OS-native credential manager.
 */
export async function deleteApiKey(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}
