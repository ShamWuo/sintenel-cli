import { normalize, relative, resolve } from "node:path";
import { realpathSync, existsSync } from "node:fs";

/**
 * Ensures `relativePath` stays under `root` after resolution (blocks .. escape).
 */
export function resolveUnderRoot(root: string, relativePath: string): string {
  const rootNorm = resolve(normalize(root));
  const joined = resolve(rootNorm, normalize(relativePath));
  
  // Check basic path escape
  const rel = relative(rootNorm, joined);
  if (rel.startsWith("..") || rel === "..") {
    throw new Error(`Path escapes working directory: ${relativePath}`);
  }
  
  // Resolve symlinks if path exists to prevent symlink escape attacks
  if (existsSync(joined)) {
    try {
      const realJoined = realpathSync(joined);
      const realRel = relative(rootNorm, realJoined);
      if (realRel.startsWith("..") || realRel === "..") {
        throw new Error(`Path (via symlink) escapes working directory: ${relativePath}`);
      }
    } catch (err) {
      // If realpathSync fails, path might not exist or be inaccessible
      // We'll let the actual operation handle this error
    }
  }
  
  return joined;
}
