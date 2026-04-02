import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileOperatorTool, type FileOperatorContext } from './fileOperator.js';

describe('fileOperator', () => {
  const testRoot = join(process.cwd(), 'test-tmp-fileop');
  let mockAudit = vi.fn();
  let writeAllowed = true;
  let destructiveAllowed = false;

  const createContext = (): FileOperatorContext => ({
    cwd: testRoot,
    audit: mockAudit,
    agent: 'test-agent',
    writeAllowed: () => writeAllowed,
    allowDestructiveOps: () => destructiveAllowed,
  });

  beforeEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true });
    mkdirSync(testRoot, { recursive: true });
    mockAudit.mockClear();
    writeAllowed = true;
    destructiveAllowed = false;
  });

  afterEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true });
  });

  describe('read action', () => {
    it('should read a file successfully', async () => {
      const testFile = join(testRoot, 'test.txt');
      writeFileSync(testFile, 'Hello World\nLine 2\nLine 3', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await (tool.execute as any)({ action: 'read', path: 'test.txt' }, {} as any);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.content).toBe('Hello World\nLine 2\nLine 3');
      }
    });

    it('should read specific line ranges', async () => {
      const testFile = join(testRoot, 'test.txt');
      writeFileSync(testFile, 'Line 1\nLine 2\nLine 3\nLine 4', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await (tool.execute as any)({ 
        action: 'read', 
        path: 'test.txt',
        startLine: 2,
        endLine: 3 
      }, {} as any);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.content).toBe('Line 2\nLine 3');
      }
    });

    it('should reject reading non-existent files', async () => {
      const tool = createFileOperatorTool(createContext());
      const result = await (tool.execute as any)({ action: 'read', path: 'nonexistent.txt' }, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('not found');
      }
    });

    it('should reject binary files', async () => {
      const testFile = join(testRoot, 'binary.bin');
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(testFile, buffer);

      const tool = createFileOperatorTool(createContext());
      const result = await (tool.execute as any)({ action: 'read', path: 'binary.bin' }, {} as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('forbidden');
      }
    });

    it('should reject files exceeding size limit', async () => {
      const testFile = join(testRoot, 'large.txt');
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(testFile, largeContent, 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ action: 'read', path: 'large.txt' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('too large');
      }
    });

    it('should reject absolute paths', async () => {
      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ 
        action: 'read', 
        path: process.platform === 'win32' ? 'C:\\Windows\\System32\\cmd.exe' : '/etc/passwd'
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('forbidden');
      }
    });
  });

  describe('write action', () => {
    it('should write a file successfully', async () => {
      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ 
        action: 'write', 
        path: 'output.txt',
        content: 'Test content'
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(existsSync(join(testRoot, 'output.txt'))).toBe(true);
        expect(readFileSync(join(testRoot, 'output.txt'), 'utf8')).toBe('Test content');
      }
    });

    it('should block writes when writeAllowed is false', async () => {
      writeAllowed = false;
      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ 
        action: 'write', 
        path: 'blocked.txt',
        content: 'Should not write'
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('blocked');
      }
    });
  });

  describe('patch action', () => {
    it('should patch a file with unique snippet', async () => {
      const testFile = join(testRoot, 'code.js');
      writeFileSync(testFile, 'const x = 1;\nconst y = 2;\nconst z = 3;', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ 
        action: 'patch', 
        path: 'code.js',
        oldSnippet: 'const y = 2;',
        newSnippet: 'const y = 20;'
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.replacements).toBe(1);
        const content = readFileSync(testFile, 'utf8');
        expect(content).toBe('const x = 1;\nconst y = 20;\nconst z = 3;');
      }
    });

    it('should reject non-unique snippets without context', async () => {
      const testFile = join(testRoot, 'code.js');
      writeFileSync(testFile, 'foo();\nbar();\nfoo();', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ 
        action: 'patch', 
        path: 'code.js',
        oldSnippet: 'foo();',
        newSnippet: 'baz();'
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Ambiguous');
      }
    });

    it('should replace all occurrences with replaceAll=true', async () => {
      const testFile = join(testRoot, 'code.js');
      writeFileSync(testFile, 'foo();\nbar();\nfoo();', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ 
        action: 'patch', 
        path: 'code.js',
        oldSnippet: 'foo();',
        newSnippet: 'baz();',
        replaceAll: true
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.replacements).toBe(2);
        const content = readFileSync(testFile, 'utf8');
        expect(content).toBe('baz();\nbar();\nbaz();');
      }
    });

    it('should use context to disambiguate', async () => {
      const testFile = join(testRoot, 'code.js');
      writeFileSync(testFile, 'a = foo();\nb = foo();\nc = foo();', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ 
        action: 'patch', 
        path: 'code.js',
        oldSnippet: 'foo();',
        newSnippet: 'bar();',
        contextBefore: 'b = '
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const content = readFileSync(testFile, 'utf8');
        expect(content).toBe('a = foo();\nb = bar();\nc = foo();');
      }
    });
  });

  describe('rollback action', () => {
    it('should rollback to latest backup', async () => {
       const testFile = join(testRoot, 'config.txt');
       writeFileSync(testFile, 'v1', 'utf8');
       
       const tool = createFileOperatorTool(createContext());
       // Simulate a change with backup
       await tool.execute({ 
         action: 'write', 
         path: 'config.txt', 
         content: 'v2', 
         backupExisting: true 
       });
       
       expect(readFileSync(testFile, 'utf8')).toBe('v2');
       
       const result = await tool.execute({ 
         action: 'rollback', 
         path: 'config.txt' 
       });
       
       expect(result.ok).toBe(true);
       expect(readFileSync(testFile, 'utf8')).toBe('v1');
    });
  });

  describe('delete action', () => {
    it('should delete a file when destructive ops enabled', async () => {
      destructiveAllowed = true;
      const testFile = join(testRoot, 'delete-me.txt');
      writeFileSync(testFile, 'Content', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ action: 'delete', path: 'delete-me.txt' });

      expect(result.ok).toBe(true);
      expect(existsSync(testFile)).toBe(false);
    });

    it('should block delete when destructive ops disabled', async () => {
      const testFile = join(testRoot, 'protected.txt');
      writeFileSync(testFile, 'Content', 'utf8');

      const tool = createFileOperatorTool(createContext());
      const result = await tool.execute({ action: 'delete', path: 'protected.txt' });

      expect(result.ok).toBe(false);
      expect(existsSync(testFile)).toBe(true);
    });
  });
});
