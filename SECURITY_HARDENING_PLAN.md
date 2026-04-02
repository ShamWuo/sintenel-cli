# Security Hardening: API Key Management

Transitioning from plaintext `.env` storage to a more secure, modern authentication model.

## Current Vulnerability
- **Storage:** `.env` file in project root (Plaintext).
- **Leak Vectors:** Malicious file reads, process environment dumps, accidental git commits.

## Proposed Solutions

### Phase 1: OS Credential Manager (Recommended for Standalone)
Use the OS-native secret store (Windows Credential Manager / macOS Keychain).

1.  **Add `conf` or `keytar`:** Manage encrypted configuration storage.
2.  **`sintenel setup` command:**
    - Prompt for API key once.
    - Store it securely in the OS keychain.
    - Remove requirement for `.env`.
3.  **Encrypted Vault in `agentManager`:**
    - Retrieve key at runtime only when initializing models.
    - Zero permanent plaintext files on disk.

### Phase 2: Session-Only Memory (Ultra-Paranoid)
For environments where even the keychain isn't trusted (e.g., public competition labs).

1.  **Read-only Startup:** If no key is found, prompt the user to paste it.
2.  **RAM Isolation:** The key exists only in the current process memory and is destroyed upon exit.

### Phase 3: Web Authentication & Proxy (Enterprise/SaaS)
The most robust "web app auth thing."

1.  **OAuth Bridge:** Use a tool like Auth0 or a custom Next.js backend.
2.  **`sintenel login`:**
    - Opens `https://auth.sintenel.io`.
    - User authenticates.
    - Local server at `localhost:4545` captures the callback code.
3.  **Proxy Requests:** 
    - Instead of calling Gemini directly, the CLI calls `api.sintenel.io/v1/orchestrate`.
    - The server validates the user's JWT and injects the `GOOGLE_GENERATIVE_AI_API_KEY`.
    - This allows for total control, revocation, and billing management.

## Recommendation
For the current version of Sintenel-CLI, **Phase 1** is the most immediate win. It removes "the file with the secrets" while keeping the tool standalone and fast.
