# Sintenel-CLI Visual Demo

Terminal output examples showing Sintenel-CLI in action.

## Example 1: Session Start

```
════════════════════════════════════════════════════════════
SINTENEL-CLI SESSION
════════════════════════════════════════════════════════════

ℹ Goal: Find SQL injection vulnerabilities in src/api and fix them
ℹ Working directory: C:\Users\dev\myproject

[Orchestrator]
I'll scan your API routes for SQL injection patterns and apply parameterized 
queries. This will involve reading files, analyzing query patterns, and 
generating patches.
```

## Example 2: Execution Plan

```
════════════════════════════════════════════════════════════
EXECUTION PLAN (PENDING CONFIRMATION)
════════════════════════════════════════════════════════════

ℹ Summary: Scan and remediate SQL injection vulnerabilities
ℹ Objective: Eliminate SQL injection attack vectors in API routes
ℹ Scope: src/api/**/*.ts (3 files)
ℹ Rollback: Backup files created with .backup.* extension

┌─────────────────────────┬────────────────────────────────────────┐
│ Purpose                 │ Command                                │
├─────────────────────────┼────────────────────────────────────────┤
│ List API files          │ Get-ChildItem -Recurse src/api/*.ts    │
│ Scan for SQL patterns   │ Select-String "db\\.query|db\\.exec"  │
│ Read vulnerable files   │ fileOperator read                      │
│ Apply patches           │ fileOperator patch                     │
│ Run tests               │ npm test                               │
└─────────────────────────┴────────────────────────────────────────┘

▶ Risks
⚠ Query logic may need adjustment for complex queries
⚠ Tests may fail if query signatures changed

ℹ Plan fingerprint: a1b2c3d4e5f6...890abc

Execute planned shell commands and continue? [Y/N]: 
```

## Example 3: Agent Execution

```
Y

✓ Execution plan approved

[Scout]
Scanning API routes for SQL injection patterns...

⠋ Analyzing src/api/users.ts...
⠋ Analyzing src/api/posts.ts...
⠋ Analyzing src/api/comments.ts...

✓ Scan complete

Found 3 SQL injection vulnerabilities:

⚠ src/api/users.ts:23
   const query = `SELECT * FROM users WHERE id = ${userId}`;
   Risk: Critical - User input directly in query

⚠ src/api/posts.ts:45  
   db.query(`SELECT * FROM posts WHERE author = ${req.query.author}`);
   Risk: Critical - Query parameter injection

⚠ src/api/comments.ts:67
   const sql = `DELETE FROM comments WHERE id = ${commentId}`;
   Risk: High - Destructive query with injection vector

[Fixer]
Applying parameterized query patches...

⠋ Patching src/api/users.ts...
✓ Patched src/api/users.ts (1 replacement)
   - Replaced string interpolation with execute() and parameters

⠋ Patching src/api/posts.ts...
✓ Patched src/api/posts.ts (1 replacement)
   - Replaced db.query() with parameterized version

⠋ Patching src/api/comments.ts...
✓ Patched src/api/comments.ts (1 replacement)
   - Added parameter binding for DELETE query

⠋ Running verification...
⠋ npm test
✓ All tests passed (23 tests)

Summary:
  • 3 SQL injection vulnerabilities identified
  • 3 patches applied successfully
  • 0 tests broken
  • Backup files created: *.backup.*.ts
```

## Example 4: Session Complete

```
════════════════════════════════════════════════════════════
SESSION COMPLETE
════════════════════════════════════════════════════════════

┌───────────────────────┬──────────────┐
│ Metric                │ Value        │
├───────────────────────┼──────────────┤
│ Prompt Tokens         │ 16,892       │
│ Completion Tokens     │ 5,523        │
│ Total Tokens          │ 22,415       │
└───────────────────────┴──────────────┘

Estimated cost: $0.0025 (22,415 tokens)

✓ Audit log saved: sentinel-audit.log
✓ Changes committed: 3 files modified
```

## Example 5: Audit Log Verification

```
$ sintenel verify-audit

════════════════════════════════════════════════════════════
AUDIT LOG VERIFICATION
════════════════════════════════════════════════════════════

ℹ Audit log: C:\Users\dev\myproject\sentinel-audit.log
ℹ Entries: 47
ℹ HMAC protection: Enabled

⠋ Verifying hash chain...
✓ Sequence numbers: 1-47 (continuous)
✓ Hash chain: Intact
✓ HMAC signatures: All valid
✓ No tampering detected

┌─────────────────────┬────────────┐
│ Metric              │ Value      │
├─────────────────────┼────────────┤
│ Total Entries       │ 47         │
│ System Events       │ 5          │
│ Tool Calls          │ 24         │
│ AI Responses        │ 12         │
│ Commands Executed   │ 6          │
├─────────────────────┼────────────┤
│ Terminal Hash       │ f9e8d7...  │
└─────────────────────┴────────────┘

Verification Status: ✅ PASSED
```

## Example 6: Cost Analysis

```
$ npm run analyze-costs

════════════════════════════════════════════════════════════
AI COST ANALYSIS
════════════════════════════════════════════════════════════

ℹ Analyzing: sentinel-audit.log

┌──────────────┬─────────┬────────────┬───────────┬──────────┐
│ Agent        │ Calls   │ Prompt     │ Completion│ Cost     │
├──────────────┼─────────┼────────────┼───────────┼──────────┤
│ Orchestrator │ 4       │ 12,456     │ 3,234     │ $0.0014  │
│ Scout        │ 2       │ 2,891      │ 1,123     │ $0.0004  │
│ Fixer        │ 3       │ 3,245      │ 1,456     │ $0.0004  │
├──────────────┼─────────┼────────────┼───────────┼──────────┤
│ TOTAL        │ 9       │ 18,592     │ 5,813     │ $0.0022  │
└──────────────┴─────────┴────────────┴───────────┴──────────┘

💡 Optimization Tips:
  ✓ Using tiered models (75% savings)
  ✓ Token limits enforced
  • Consider narrowing goal scope for even lower costs

📊 Cost Comparison:
  • Sintenel-CLI: $0.0022 (this session)
  • Aider + GPT-4: $0.12 (54x more)
  • Manual developer: $15.00 (18 min @ $50/hr)

Savings: $14.998 per task vs manual ✅
```

## Example 7: Benchmark Results

```
$ npm run benchmark

🔬 Sintenel-CLI Benchmark Suite
Testing performance, cost, and accuracy across security scenarios

🏃 Running benchmark: Sintenel: SQL Injection...
✓ Complete: 3/3 issues in 4500ms ($0.0018)

🏃 Running benchmark: Sintenel: Secrets...
✓ Complete: 5/5 issues in 3200ms ($0.0012)

🏃 Running benchmark: Sintenel: CORS...
✓ Complete: 1/1 issues in 2800ms ($0.0010)

🏃 Running benchmark: Manual (Developer)...
✓ Complete: 3/3 issues in 900000ms ($12.50)

🏃 Running benchmark: Aider + GPT-4...
✓ Complete: 2/3 issues in 25000ms ($0.0950)

════════════════════════════════════════════════════════════
BENCHMARK RESULTS
════════════════════════════════════════════════════════════

| Tool                 | Time (ms) | Cost     | Found | Fixed | Accuracy |
|----------------------|-----------|----------|-------|-------|----------|
| Sintenel: SQL        |      4500 | $0.0018  | 3     | 3     | 100.0%   |
| Sintenel: Secrets    |      3200 | $0.0012  | 5     | 5     | 100.0%   |
| Sintenel: CORS       |      2800 | $0.0010  | 1     | 1     | 100.0%   |
| Manual (Developer)   |    900000 | $12.50   | 3     | 3     | 95.0%    |
| Aider + GPT-4        |     25000 | $0.0950  | 3     | 2     | 85.0%    |

════════════════════════════════════════════════════════════

Averages:
  Time: 187100ms
  Cost: $2.5028
  Accuracy: 96.0%

💡 Key Insights:
  • Sintenel-CLI is 200x faster than manual remediation
  • 59x cheaper than Aider with GPT-4 ($0.0017 vs $0.095)
  • 100% accuracy with human-in-the-loop approval
  • Multi-agent architecture enables parallel execution

📊 Results exported to: benchmarks/results-2026-03-26T17-45-00.json
```

---

## Color Legend

When running Sintenel-CLI, you'll see:

- 🟣 **Magenta** - Orchestrator messages
- 🔵 **Cyan** - Scout messages  
- 🟢 **Green** - Fixer messages, success indicators
- 🟡 **Yellow** - Warnings, risks
- 🔴 **Red** - Errors, failures
- ⚪ **White/Gray** - Info, metadata

---

## Terminal Features

- **Spinners**: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏ (animated in real terminal)
- **Checkmarks**: ✓ (success), ✗ (failure)
- **Icons**: ℹ (info), ⚠ (warning), 🏃 (running), 🔬 (testing)
- **Tables**: Aligned columns with borders
- **Progress Bars**: `█████████░░` (animated)

---

**These visuals demonstrate the professional UX that sets Sintenel-CLI apart from command-line competitors.**
