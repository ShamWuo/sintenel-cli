import * as esbuild from "esbuild";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const outfile = "dist/sintenel.cjs";

if (!existsSync(dirname(outfile))) {
  mkdirSync(dirname(outfile), { recursive: true });
}

try {
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    outfile: outfile,
    minify: true,
    external: ["keytar"],
    logOverride: {
      "empty-import-meta": "silent",
    },
    banner: {
      js: "#!/usr/bin/env node",
    },
  });
  console.log("✅ Bundle successfully created at " + outfile);
} catch (e) {
  console.error("❌ Bundle failed:", e);
  process.exit(1);
}
