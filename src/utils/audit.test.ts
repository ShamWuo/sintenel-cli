import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appendAuditLog, auditLogPathForCwd, _resetAuditChainForTesting } from './audit.js';
import { readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

describe('audit', () => {
  const testRoot = join(process.cwd(), 'test-tmp-audit');

  beforeEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
    _resetAuditChainForTesting();
  });

  afterEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true });
    _resetAuditChainForTesting();
  });

  it('should create audit log file', () => {
    appendAuditLog(testRoot, {
      kind: 'system',
      payload: { event: 'test' },
    });

    const logPath = auditLogPathForCwd(testRoot);
    expect(existsSync(logPath)).toBe(true);
  });

  it('should write valid JSON lines with chain fields', () => {
    appendAuditLog(testRoot, {
      kind: 'system',
      agent: 'test',
      payload: { event: 'start' },
    });

    appendAuditLog(testRoot, {
      kind: 'ai',
      agent: 'orchestrator',
      payload: { text: 'Hello', usage: { totalTokens: 100 } },
    });

    const logPath = auditLogPathForCwd(testRoot);
    const content = readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n');

    expect(lines.length).toBe(2);
    
    const entry1 = JSON.parse(lines[0]);
    expect(entry1.kind).toBe('system');
    expect(entry1.ts).toBeDefined();
    expect(entry1.seq).toBe(1);
    expect(entry1.prevHash).toBeDefined();
    expect(entry1.hash).toBeDefined();
    expect(entry1.payload.event).toBe('start');

    const entry2 = JSON.parse(lines[1]);
    expect(entry2.kind).toBe('ai');
    expect(entry2.agent).toBe('orchestrator');
    expect(entry2.seq).toBe(2);
    expect(entry2.prevHash).toBe(entry1.hash);
    expect(entry2.payload.text).toBe('Hello');
  });

  it('should include timestamp in entries', () => {
    appendAuditLog(testRoot, {
      kind: 'tool',
      agent: 'scout',
      payload: { tool: 'fileOperator' },
    });

    const logPath = auditLogPathForCwd(testRoot);
    const content = readFileSync(logPath, 'utf8');
    const entry = JSON.parse(content.trim().split('\n')[0]);

    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should handle custom timestamps', () => {
    const customTs = '2026-03-26T12:00:00.000Z';
    appendAuditLog(testRoot, {
      kind: 'system',
      ts: customTs,
      payload: { event: 'custom' },
    });

    const logPath = auditLogPathForCwd(testRoot);
    const content = readFileSync(logPath, 'utf8');
    const entry = JSON.parse(content.trim().split('\n')[0]);

    expect(entry.ts).toBe(customTs);
  });

  it('should chain entries with hashes', () => {
    appendAuditLog(testRoot, { kind: 'system', payload: { event: '1' } });
    appendAuditLog(testRoot, { kind: 'system', payload: { event: '2' } });
    appendAuditLog(testRoot, { kind: 'system', payload: { event: '3' } });

    const logPath = auditLogPathForCwd(testRoot);
    const content = readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n').map(l => JSON.parse(l));

    expect(lines[0].seq).toBe(1);
    expect(lines[1].seq).toBe(2);
    expect(lines[2].seq).toBe(3);

    expect(lines[1].prevHash).toBe(lines[0].hash);
    expect(lines[2].prevHash).toBe(lines[1].hash);
  });
});
