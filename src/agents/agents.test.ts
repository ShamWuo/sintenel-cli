import { describe, it, expect } from 'vitest';
import { SCOUT_SYSTEM } from './scout.js';
import { ORCHESTRATOR_SYSTEM } from './orchestrator.js';
import { FIXER_SYSTEM } from './fixer.js';

describe('Agent System Prompts: Nationals Tier Compliance', () => {
  it('Scout should prioritize Python 3 for Linux recon', () => {
    expect(SCOUT_SYSTEM).toContain('python3');
    expect(SCOUT_SYSTEM).toContain('audit_linux.py');
  });

  it('Scout should support Parallel Reconnaissance', () => {
    expect(SCOUT_SYSTEM).toContain('Parallelism');
    expect(SCOUT_SYSTEM).toContain('multiple `executeShell`');
  });

  it('Orchestrator should follow the Phase 0: README Recon workflow', () => {
    expect(ORCHESTRATOR_SYSTEM).toContain('Phase 0: Recon & README');
    expect(ORCHESTRATOR_SYSTEM).toContain('authorized state');
  });

  it('Orchestrator should support Parallel Execution', () => {
    expect(ORCHESTRATOR_SYSTEM).toContain('EXECUTE IN PARALLEL');
    expect(ORCHESTRATOR_SYSTEM).toContain('multiple tools');
  });

  it('Fixer should enforce Surgical Rules', () => {
    expect(FIXER_SYSTEM).toContain('SURGICAL RULES');
    expect(FIXER_SYSTEM).toContain('Atomics');
    expect(FIXER_SYSTEM).toContain('Nondestructive');
  });

  it('Fixer should perform verification after modifications', () => {
    expect(FIXER_SYSTEM).toContain('Verification');
    expect(FIXER_SYSTEM).toContain('run a check AFTER');
  });
});
