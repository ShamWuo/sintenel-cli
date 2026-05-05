import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

console.log("[STATUS] [COMPILER] Starting Standalone Build...");

// 1. Ensure bundle exists
if (!existsSync("dist/sintenel.cjs")) {
  console.log("[INFO] Bundle missing. Building first...");
  execSync("npm run bundle", { stdio: "inherit" });
}

// 2. Run pkg
console.log("[INFO] Packaging into standalone executables...");
try {
  // We target Windows, Linux, and macOS
  // --public-packages "*" is needed for some dependencies
  // --output-path bin/
  if (!existsSync("bin")) mkdirSync("bin");

  execSync("npx pkg dist/sintenel.cjs --targets node18-win-x64,node18-linux-x64 --out-path bin/", { stdio: "inherit" });
  
  console.log("\n[DONE] Standalone binaries created in /bin");
  console.log("   - bin/sintenel.exe (Windows)");
  console.log("   - bin/sintenel (Linux)");
} catch (err) {
  console.error("[FAIL] Packaging failed:", err.message);
  process.exit(1);
}
