import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveUnderRoot } from '../utils/paths.js';

describe('resolveUnderRoot', () => {
  const testRoot = join(process.cwd(), 'test-tmp-paths');

  beforeEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true });
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testRoot)) rmSync(testRoot, { recursive: true });
  });

  it('should resolve normal relative paths', () => {
    const result = resolveUnderRoot(testRoot, 'foo/bar.txt');
    expect(result).toBe(join(testRoot, 'foo', 'bar.txt'));
  });

  it('should block path traversal with ..', () => {
    expect(() => {
      resolveUnderRoot(testRoot, '../outside.txt');
    }).toThrow(/escapes working directory/);
  });

  it('should block path traversal with multiple ..', () => {
    expect(() => {
      resolveUnderRoot(testRoot, 'foo/../../outside.txt');
    }).toThrow(/escapes working directory/);
  });

  it('should allow .. that stays within root', () => {
    const result = resolveUnderRoot(testRoot, 'foo/../bar.txt');
    expect(result).toBe(join(testRoot, 'bar.txt'));
  });

  it('should handle current directory references', () => {
    const result = resolveUnderRoot(testRoot, './foo/./bar.txt');
    expect(result).toBe(join(testRoot, 'foo', 'bar.txt'));
  });

  it('should normalize paths with mixed slashes', () => {
    const result = resolveUnderRoot(testRoot, 'foo\\bar/baz.txt');
    expect(result).toBe(join(testRoot, 'foo', 'bar', 'baz.txt'));
  });

  it('should block symlink escape attacks', () => {
    // Create a symlink pointing outside root
    const outsideDir = join(process.cwd(), 'outside-root');
    const symlinkPath = join(testRoot, 'escape-link');
    
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(join(outsideDir, 'secret.txt'), 'secret', 'utf8');
    
    try {
      // On Windows, this requires admin privileges, so we'll skip if it fails
      try {
        require('fs').symlinkSync(outsideDir, symlinkPath, 'dir');
      } catch {
        return; // Skip test if symlink creation fails
      }

      expect(() => {
        resolveUnderRoot(testRoot, 'escape-link/secret.txt');
      }).toThrow(/escapes working directory/);
    } finally {
      if (existsSync(symlinkPath)) rmSync(symlinkPath, { recursive: true });
      if (existsSync(outsideDir)) rmSync(outsideDir, { recursive: true });
    }
  });

  it('should handle empty path segments', () => {
    const result = resolveUnderRoot(testRoot, 'foo//bar///baz.txt');
    expect(result).toBe(join(testRoot, 'foo', 'bar', 'baz.txt'));
  });

  it('should reject absolute paths implicitly via relative check', () => {
    // resolveUnderRoot doesn't explicitly check, but the relative check catches it
    const absolutePath = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/passwd';
    expect(() => {
      resolveUnderRoot(testRoot, absolutePath);
    }).toThrow();
  });
});
