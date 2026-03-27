import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileOperatorTool, type FileOperatorContext } from './tools/fileOperator.js';
import { appendAuditLog, _resetAuditChainForTesting } from './utils/audit.js';

describe('Integration: Multi-file Security Remediation', () => {
  const testRoot = join(process.cwd(), 'test-tmp-integration');
  const mockAudit = vi.fn();

  beforeEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
    _resetAuditChainForTesting();
    mockAudit.mockClear();
  });

  afterEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true });
  });

  it('should fix SQL injection across multiple files', async () => {
    // Setup: Create vulnerable files
    mkdirSync(join(testRoot, 'src'), { recursive: true });
    
    writeFileSync(
      join(testRoot, 'src', 'users.js'),
      `app.get('/users/:id', (req, res) => {\n  db.query(\`SELECT * FROM users WHERE id = \${req.params.id}\`);\n});`,
      'utf8'
    );

    writeFileSync(
      join(testRoot, 'src', 'posts.js'),
      `app.get('/posts/:id', (req, res) => {\n  db.query(\`SELECT * FROM posts WHERE id = \${req.params.id}\`);\n});`,
      'utf8'
    );

    const ctx: FileOperatorContext = {
      cwd: testRoot,
      audit: mockAudit,
      agent: 'fixer',
      writeAllowed: () => true,
      allowDestructiveOps: () => false,
    };

    const tool = createFileOperatorTool(ctx);

    // Fix file 1
    const result1 = await tool.execute({
      action: 'patch',
      path: 'src/users.js',
      oldSnippet: 'db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);',
      newSnippet: 'db.query("SELECT * FROM users WHERE id = ?", [req.params.id]);',
    });

    // Fix file 2
    const result2 = await tool.execute({
      action: 'patch',
      path: 'src/posts.js',
      oldSnippet: 'db.query(`SELECT * FROM posts WHERE id = ${req.params.id}`);',
      newSnippet: 'db.query("SELECT * FROM posts WHERE id = ?", [req.params.id]);',
    });

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    // Verify fixes
    const users = readFileSync(join(testRoot, 'src', 'users.js'), 'utf8');
    const posts = readFileSync(join(testRoot, 'src', 'posts.js'), 'utf8');

    expect(users).toContain('db.query("SELECT * FROM users WHERE id = ?", [req.params.id])');
    expect(posts).toContain('db.query("SELECT * FROM posts WHERE id = ?", [req.params.id])');
  });

  it('should maintain audit trail during complex workflow', async () => {
    const auditDir = join(testRoot, 'audit-test');
    mkdirSync(auditDir, { recursive: true });
    _resetAuditChainForTesting(auditDir);

    // Simulate workflow with real audit logging
    appendAuditLog(auditDir, {
      kind: 'system',
      payload: { event: 'session_start', goal: 'Fix vulnerabilities' },
    });

    appendAuditLog(auditDir, {
      kind: 'tool',
      agent: 'scout',
      payload: { tool: 'fileOperator', action: 'read', path: 'test.js' },
    });

    appendAuditLog(auditDir, {
      kind: 'ai',
      agent: 'scout',
      payload: { text: 'Found SQL injection', usage: { totalTokens: 150 } },
    });

    appendAuditLog(auditDir, {
      kind: 'tool',
      agent: 'fixer',
      payload: { tool: 'fileOperator', action: 'patch', path: 'test.js' },
    });

    appendAuditLog(auditDir, {
      kind: 'system',
      payload: { event: 'session_end', reason: 'complete' },
    });

    const auditLogPath = join(auditDir, 'sentinel-audit.log');
    expect(existsSync(auditLogPath)).toBe(true);

    const content = readFileSync(auditLogPath, 'utf8');
    const entries = content.trim().split('\n').map(l => JSON.parse(l));

    expect(entries.length).toBe(5);
    expect(entries[0].kind).toBe('system');
    expect(entries[1].kind).toBe('tool');
    expect(entries[2].kind).toBe('ai');
    expect(entries[3].kind).toBe('tool');
    expect(entries[4].kind).toBe('system');

    // Verify chain integrity
    expect(entries[0].seq).toBe(1);
    expect(entries[1].seq).toBe(2);
    expect(entries[1].prevHash).toBe(entries[0].hash);
    expect(entries[2].prevHash).toBe(entries[1].hash);
  });

  it('should handle file operations with backup and rollback', async () => {
    const testFile = join(testRoot, 'important.js');
    const originalContent = 'const x = 1;\nconst y = 2;';
    writeFileSync(testFile, originalContent, 'utf8');

    const ctx: FileOperatorContext = {
      cwd: testRoot,
      audit: mockAudit,
      agent: 'fixer',
      writeAllowed: () => true,
      allowDestructiveOps: () => false,
    };

    const tool = createFileOperatorTool(ctx);

    // Make change with backup
    const result = await tool.execute({
      action: 'patch',
      path: 'important.js',
      oldSnippet: 'const y = 2;',
      newSnippet: 'const y = 20;',
      backupExisting: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.backupPath) {
      // Verify backup exists
      expect(existsSync(result.backupPath)).toBe(true);
      
      // Verify backup content
      const backupContent = readFileSync(result.backupPath, 'utf8');
      expect(backupContent).toBe(originalContent);
      
      // Verify original is modified
      const modifiedContent = readFileSync(testFile, 'utf8');
      expect(modifiedContent).toBe('const x = 1;\nconst y = 20;');
    }
  });

  it('should enforce security boundaries across workflow', async () => {
    // Scout context: read-only
    const scoutCtx: FileOperatorContext = {
      cwd: testRoot,
      audit: mockAudit,
      agent: 'scout',
      writeAllowed: () => false,
      allowDestructiveOps: () => false,
    };

    // Fixer context: write-allowed after approval
    const fixerCtx: FileOperatorContext = {
      cwd: testRoot,
      audit: mockAudit,
      agent: 'fixer',
      writeAllowed: () => true,
      allowDestructiveOps: () => false,
    };

    writeFileSync(join(testRoot, 'test.js'), 'content', 'utf8');

    const scoutTool = createFileOperatorTool(scoutCtx);
    const fixerTool = createFileOperatorTool(fixerCtx);

    // Scout can read
    const scoutRead = await scoutTool.execute({ action: 'read', path: 'test.js' });
    expect(scoutRead.ok).toBe(true);

    // Scout cannot write
    const scoutWrite = await scoutTool.execute({ 
      action: 'write', 
      path: 'hack.js',
      content: 'bad'
    });
    expect(scoutWrite.ok).toBe(false);

    // Fixer can write
    const fixerWrite = await fixerTool.execute({ 
      action: 'write', 
      path: 'fixed.js',
      content: 'good'
    });
    expect(fixerWrite.ok).toBe(true);
    expect(existsSync(join(testRoot, 'fixed.js'))).toBe(true);
  });
});
