# 🛡️ Sintenel-CLI: CyberPatriot / Hardened Image Troubleshooting

This document is for when you are on a restricted "Competition" image where malware has disabled common OS tools like `cmd.exe`, `regedit`, or `npm`.

## 🚨 Symptom: `The system cannot find the file specified` OR `ENOENT spawn cmd.exe`
The image has malware or Group Polices that block or **delete** `cmd.exe` from `C:\Windows\system32\`.

### ✅ THE FIX: Restore and Unblock
Run these commands in **PowerShell** as Admin:

```powershell
# 1. Restore the physical file from backup
Copy-Item "C:\Windows\SysWOW64\cmd.exe" "C:\Windows\System32\cmd.exe" -Force -ErrorAction SilentlyContinue

# 2. Unblock the Registry Policy
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System" -Name "DisableCMD" -Value 0

# 3. Unblock Registry Tools (regedit)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System" -Name "DisableRegistryTools" -Value 0
```

---

## 🚨 Symptom: `EPERM: operation not permitted` during `npm install`
You are likely working inside `C:\Windows\system32\`. Windows denies most write operations here to protect the core system.

### ✅ THE FIX: Move to C:\ Root
**NEVER** run node/npm projects from inside `system32`. 
```powershell
Move-Item "C:\Windows\system32\sintenel-cli" "C:\sintenel-cli"
cd "C:\sintenel-cli"
```

---

## 🚨 Symptom: `npm install` hangs or crashes on `native-modules`
Many packages (like `keytar`) try to run "post-install" scripts that require a working shell.

### ✅ THE FIX: Skip scripts
```powershell
npm install --omit=dev --ignore-scripts
```

---

## 🚨 Symptom: `Error: Cannot find module '...esbuild'`
You are likely using `--omit=dev` during `npm install`. Since `esbuild` is a development tool, it is not installed by default in a "Production" run.

### ✅ THE FIX: Manual Install
```powershell
# 1. Force-install the compiler without scripts (bypasses blocks)
npm install esbuild --no-save --ignore-scripts

# 2. Run the direct build (bypasses cmd.exe shells)
node node_modules\esbuild\bin\esbuild src\index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist\sintenel.cjs --minify --banner:js="#!/usr/bin/env node"
```

---

## 🚨 Symptom: `TypeError [ERR_INVALID_ARG_VALUE]` / `import.meta` crash
The bundle was built as **CommonJS (CJS)**, but some code used ESM-only `import.meta.url`. 

### ✅ THE FIX: Polyfill (Already Applied)
If you see this error, ensure you are using the **latest code** from `src/utils/secrets.ts`, which now includes a resilient `_require` polyfill that works in both ESM and CJS modes.

---

## 🚨 Symptom: I can't bundle because `npm` is still broken
If you can't run `npm run bundle`, skip `npm` and call the compiler directly via Node:

### ✅ THE FIX: Direct Node Compiler
```powershell
node node_modules\esbuild\bin\esbuild src\index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist\sintenel.cjs --minify --banner:js="#!/usr/bin/env node"
```

---

## 🎯 Competition Survival Guide
1. **Always use `.\sintenel.ps1`**: This script automatically attempts to unblock `cmd.exe` every time it starts.
2. **Setup First**: Run `.\sintenel.ps1 setup` to verify your API Key is stored safely.
3. **Audit the Audit**: Use `.\sintenel.ps1 "Audit the security of my own system32 folder"` to find where the malware is hiding!

---

## 🦾 Resilience Strategy: The "Zero-Wait" Bundle
If the image is still too restricted to install **anything**, follow this "Nationals" workflow:

1. **On your Dev Machine**: Run `npm run bundle` to create `dist/sintenel.cjs`.
2. **On the Image**: Copy **JUST** the `dist/` folder and `sintenel.ps1`.
3. **Execute**: Run `.\sintenel.ps1`. This skips all Node/NPM complexity and goes straight to the security engine. 🏁

---

**Sintenel is designed for resiliency. If the tool is running, the image is being fixed. 🛡️🦾**
