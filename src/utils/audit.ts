import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, createHmac } from "node:crypto";

export const AUDIT_LOG_FILENAME = "sentinel-audit.log";

export type AuditEntry = {
  ts: string;
  kind: "command" | "ai" | "system" | "tool";
  agent?: string;
  payload: Record<string, unknown>;
};

type AuditChainEntry = AuditEntry & {
  seq: number;
  prevHash: string;
  hash: string;
};

export type AuditVerificationResult = {
  ok: boolean;
  totalEntries: number;
  errors: string[];
  terminalHash?: string;
};

export type AuditBundle = {
  version: "1";
  generatedAt: string;
  auditLogPath: string;
  auditLogSha256: string;
  totalEntries: number;
  terminalHash?: string;
  hmacProtected: boolean;
  signatureAlgorithm: "HMAC-SHA256" | "SHA256";
  signature: string;
};

const INITIAL_HASH = "0".repeat(64);
const auditChainState = new Map<string, { seq: number; lastHash: string }>();

/** Test helper to reset chain state */
export function _resetAuditChainForTesting(cwd?: string): void {
  if (cwd) {
    auditChainState.delete(cwd);
  } else {
    auditChainState.clear();
  }
}

function ensureDirForFile(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function auditLogPathForCwd(cwd: string): string {
  return join(cwd, AUDIT_LOG_FILENAME);
}

export function appendAuditLog(
  cwd: string,
  entry: Omit<AuditEntry, "ts"> & { ts?: string }
): void {
  const logPath = auditLogPathForCwd(cwd);
  try {
    ensureDirForFile(logPath);
  } catch {
    // ignore
  }
  const state = auditChainState.get(cwd) ?? { seq: 0, lastHash: INITIAL_HASH };
  const baseLine: AuditEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    kind: entry.kind,
    agent: entry.agent,
    payload: entry.payload,
  };
  const seq = state.seq + 1;
  const prevHash = state.lastHash;
  const toHash = JSON.stringify({ ...baseLine, seq, prevHash });
  const hmacKey = process.env.SINTENEL_AUDIT_HMAC_KEY?.trim();
  const hash = hmacKey
    ? createHmac("sha256", hmacKey).update(toHash, "utf8").digest("hex")
    : createHash("sha256").update(toHash, "utf8").digest("hex");
  const line: AuditChainEntry = { ...baseLine, seq, prevHash, hash };

  appendFileSync(logPath, `${JSON.stringify(line)}\n`, { encoding: "utf8" });
  auditChainState.set(cwd, { seq, lastHash: hash });
}

export function verifyAuditLog(logPath: string, hmacKey?: string): AuditVerificationResult {
  if (!existsSync(logPath)) {
    return { ok: false, totalEntries: 0, errors: [`Audit log not found: ${logPath}`] };
  }

  const raw = readFileSync(logPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let prevHash = INITIAL_HASH;
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let parsed: AuditChainEntry;
    try {
      parsed = JSON.parse(lines[i]) as AuditChainEntry;
    } catch {
      errors.push(`Line ${i + 1}: invalid JSON`);
      continue;
    }

    const expectedSeq = i + 1;
    if (parsed.seq !== expectedSeq) {
      errors.push(`Line ${i + 1}: seq mismatch (expected ${expectedSeq}, got ${parsed.seq})`);
    }
    if (parsed.prevHash !== prevHash) {
      errors.push(`Line ${i + 1}: prevHash mismatch`);
    }

    const toHash = JSON.stringify({
      ts: parsed.ts,
      kind: parsed.kind,
      agent: parsed.agent,
      payload: parsed.payload,
      seq: parsed.seq,
      prevHash: parsed.prevHash,
    });
    const expectedHash = hmacKey?.trim()
      ? createHmac("sha256", hmacKey.trim()).update(toHash, "utf8").digest("hex")
      : createHash("sha256").update(toHash, "utf8").digest("hex");
    if (parsed.hash !== expectedHash) {
      errors.push(`Line ${i + 1}: hash mismatch`);
    }
    prevHash = parsed.hash;
  }

  return {
    ok: errors.length === 0,
    totalEntries: lines.length,
    errors,
    terminalHash: lines.length > 0 ? prevHash : undefined,
  };
}

function signBundlePayload(
  payload: Omit<AuditBundle, "signature">,
  hmacKey?: string
): { signature: string; algorithm: "HMAC-SHA256" | "SHA256" } {
  const canonical = JSON.stringify(payload);
  const key = hmacKey?.trim();
  if (key) {
    return {
      algorithm: "HMAC-SHA256",
      signature: createHmac("sha256", key).update(canonical, "utf8").digest("hex"),
    };
  }
  return {
    algorithm: "SHA256",
    signature: createHash("sha256").update(canonical, "utf8").digest("hex"),
  };
}

export function exportAuditBundle(
  auditLogPath: string,
  bundlePath: string,
  hmacKey?: string
): { ok: true; bundle: AuditBundle } | { ok: false; error: string } {
  const verification = verifyAuditLog(auditLogPath, hmacKey);
  if (!verification.ok) {
    return {
      ok: false,
      error: `Cannot export bundle: audit log failed verification (${verification.errors.join("; ")})`,
    };
  }
  if (!existsSync(auditLogPath)) {
    return { ok: false, error: `Audit log not found: ${auditLogPath}` };
  }
  const raw = readFileSync(auditLogPath, "utf8");
  const auditLogSha256 = createHash("sha256").update(raw, "utf8").digest("hex");

  const unsigned: Omit<AuditBundle, "signature"> = {
    version: "1",
    generatedAt: new Date().toISOString(),
    auditLogPath,
    auditLogSha256,
    totalEntries: verification.totalEntries,
    terminalHash: verification.terminalHash,
    hmacProtected: Boolean(hmacKey?.trim()),
    signatureAlgorithm: hmacKey?.trim() ? "HMAC-SHA256" : "SHA256",
  };
  const signed = signBundlePayload(unsigned, hmacKey);
  const bundle: AuditBundle = {
    ...unsigned,
    signatureAlgorithm: signed.algorithm,
    signature: signed.signature,
  };
  writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return { ok: true, bundle };
}

export function verifyAuditBundle(
  bundlePath: string,
  hmacKey?: string
): { ok: true; bundle: AuditBundle } | { ok: false; error: string } {
  if (!existsSync(bundlePath)) {
    return { ok: false, error: `Bundle not found: ${bundlePath}` };
  }
  let parsed: AuditBundle;
  try {
    parsed = JSON.parse(readFileSync(bundlePath, "utf8")) as AuditBundle;
  } catch {
    return { ok: false, error: "Bundle is not valid JSON" };
  }
  const { signature, ...unsigned } = parsed;
  const signed = signBundlePayload(unsigned, hmacKey);
  if (signed.algorithm !== parsed.signatureAlgorithm) {
    return {
      ok: false,
      error: `Signature algorithm mismatch: expected ${signed.algorithm}, found ${parsed.signatureAlgorithm}`,
    };
  }
  if (signed.signature !== signature) {
    return { ok: false, error: "Bundle signature mismatch (tampered or wrong HMAC key)" };
  }
  if (existsSync(parsed.auditLogPath)) {
    const raw = readFileSync(parsed.auditLogPath, "utf8");
    const currentSha = createHash("sha256").update(raw, "utf8").digest("hex");
    if (currentSha !== parsed.auditLogSha256) {
      return { ok: false, error: "Audit log hash mismatch against bundle" };
    }
  }
  return { ok: true, bundle: parsed };
}
