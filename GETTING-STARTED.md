# Getting Started with Sintenel-CLI

Complete step-by-step guide to your first security audit in 5 minutes.

## Installation

### Step 1: Prerequisites

- **Node.js**: 20.x or 22.x ([Download](https://nodejs.org))
- **npm**: Comes with Node.js
- **Git**: For cloning the repository
- **API Key**: [Google Gemini API key](https://makersuite.google.com/app/apikey) (free tier available)

### Step 2: Clone & Install

```bash
git clone https://github.com/yourusername/sintenel-cli.git
cd sintenel-cli
npm install
```

Expected output:
```
added 120 packages in 15s
```

### Step 3: Configure

```bash
cp .env.example .env
```

Edit `.env`:
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

### Step 4: Verify

```bash
npm test
npm run build
```

Expected output:
```
✓ 45 tests passed
Build successful
```

✅ **You're ready!**

---

## Your First Security Audit

### Example 1: Scan for Hardcoded Secrets (30 seconds)

```bash
npm run dev -- "Scan examples/vulnerable-api for hardcoded secrets"
```

**What Happens**:

1. **Orchestrator Planning** (5s)
   ```
   [SINTENEL-CLI SESSION]
   ℹ Goal: Scan examples/vulnerable-api for hardcoded secrets
   ℹ Working directory: C:\Users\you\sintenel-cli
   
   [Orchestrator]
   I'll scan the vulnerable API example for hardcoded credentials...
   ```

2. **Execution Plan** (shown to you)
   ```
   ════════════════════════════════════════════════════════════
   EXECUTION PLAN (PENDING CONFIRMATION)
   ════════════════════════════════════════════════════════════
   
   ℹ Summary: Scan for hardcoded API keys, passwords, and secrets
   ℹ Objective: Identify credential exposure risks
   ℹ Scope: examples/vulnerable-api/**/*.ts
   
   Purpose              │ Command
   ─────────────────────┼──────────────────────────────────
   Scan files           │ Get-ChildItem examples/vulnerable-api
   Search for secrets   │ Select-String -Pattern "password|apiKey" 
   
   Execute? [Y/N]:
   ```

3. **Your Action**: Type `Y` and press Enter

4. **Scout Execution** (5s)
   ```
   ⠋ Scout analyzing files...
   ✓ Scout found 3 secrets
   
   [Scout]
   Found 3 hardcoded secrets:
   
   ⚠ server-before.ts:8
      password: 'password123'
      Risk: High - Credential in version control
   
   ⚠ server-before.ts:8  
      apiKey: 'sk-prod-abc123'
      Risk: Critical - Production key exposed
   ```

5. **Session Complete**
   ```
   ════════════════════════════════════════════════════════════
   SESSION COMPLETE
   ════════════════════════════════════════════════════════════
   
   Metric              │ Value
   ────────────────────┼──────────
   Prompt Tokens       │ 6,234
   Completion Tokens   │ 2,187
   Total Tokens        │ 8,421
   
   Estimated cost: $0.0011
   ```

**Total Time**: 30 seconds  
**Cost**: $0.0011  
**Issues Found**: 3

---

### Example 2: Fix SQL Injection (45 seconds)

```bash
npm run dev -- "Fix SQL injection in examples/vulnerable-api/server-before.ts"
```

**Flow**:

1. **Scout finds vulnerabilities** (read-only)
2. **Orchestrator creates fix plan**
3. **You review and approve** (type `Y`)
4. **Fixer applies patches**:
   - Replaces string interpolation
   - Adds parameterized queries
   - Preserves logic
5. **Verification**: Syntax check passes

**Before**:
```javascript
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
db.query(query, callback);
```

**After**:
```javascript
const [results] = await conn.execute(
  'SELECT * FROM users WHERE id = ?',
  [req.params.id]
);
```

**Result**: SQL injection eliminated in 45 seconds for $0.0018

---

## Understanding the Workflow

### The Approval Gate

**Why it exists**: Safety. No code changes happen without your explicit approval.

**What you review**:
1. **Summary**: What will be done
2. **Objective**: Why it's needed
3. **Scope**: Which files affected
4. **Commands**: Exact shell commands to run
5. **Risks**: What could go wrong
6. **Rollback Plan**: How to undo

**Example Plan**:
```
Summary: Patch SQL injection with parameterized queries
Objective: Eliminate injection attack vectors
Scope: src/api/users.ts, src/api/posts.ts
Rollback: Restore from .backup.* files

Risks:
  ⚠ May need query logic adjustment
  ⚠ Type mismatches possible

Purpose              │ Command
─────────────────────┼──────────────────
Read vulnerable file │ fileOperator read
Apply patch          │ fileOperator patch
Run tests            │ npm test

Plan fingerprint: a1b2c3...f9e8d7
```

### The Agents

**Orchestrator** (Strategic Planner)
- Analyzes your goal
- Creates execution plan
- Delegates to Scout/Fixer
- Never directly modifies files

**Scout** (Reconnaissance)
- Read-only access
- Finds vulnerabilities
- Gathers intelligence
- Reports findings

**Fixer** (Remediation)
- Writes patches
- Applies fixes
- Runs verification
- Requires approval

---

## Configuration Deep Dive

### Basic Configuration

Minimal `.env` for getting started:
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

### Advanced Configuration

Full configuration with security hardening:
```env
# API Key (required)
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here

# Model Selection (optional)
GEMINI_MODEL=gemini-3-flash-preview          # Orchestrator (strategic)
AI_SUBAGENT_MODEL=gemini-3.1-flash-lite-preview  # Scout/Fixer (lightweight)

# Security (optional)
SINTENEL_STRICT_MODE=true                    # Stricter command policy
SINTENEL_HIGH_ASSURANCE_APPROVAL=true        # Two-step approval (Y/N + challenge)
SINTENEL_AUDIT_HMAC_KEY=your_long_random_secret_here_min_32_chars
SINTENEL_ALLOW_DESTRUCTIVE_OPS=false         # Block delete/rename
```

### High-Assurance Mode

When `SINTENEL_HIGH_ASSURANCE_APPROVAL=true`:

```
Execute planned commands? [Y/N]: Y

High-assurance approval required.
Type the following challenge: KX9P2M
> KX9P2M

✓ Approved. Executing plan...
```

**Use cases**: Production systems, critical infrastructure

---

## Command Patterns

### Pattern 1: Scan + Report

```bash
sintenel "Scan [directory] for [vulnerability type]"
```

Examples:
- `"Scan src/ for SQL injection"`
- `"Find hardcoded credentials in config/"`
- `"Check api/ for CORS misconfigurations"`

### Pattern 2: Scan + Fix

```bash
sintenel "Find [issue] in [location] and fix it"
```

Examples:
- `"Find SQL injection in users.ts and apply parameterized queries"`
- `"Locate hardcoded secrets in src/ and move to env vars"`

### Pattern 3: Verify + Test

```bash
sintenel "Run [test command] to verify [aspect]"
```

Examples:
- `"Run npm test to verify fixes didn't break functionality"`
- `"Run npm audit to check for vulnerable dependencies"`

---

## Troubleshooting

### Problem: "Module not found" errors

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problem: "API key not configured"

**Solution**: Ensure `.env` exists with valid API key:
```bash
ls .env  # Should exist
cat .env | grep GOOGLE_GENERATIVE_AI_API_KEY  # Should have value
```

### Problem: "Tests failing"

**Check**:
```bash
node --version  # Should be 20.x or 22.x
npm --version   # Should be 9.x+
npm run typecheck  # Should pass
```

### Problem: "Execution blocked"

**Cause**: Tried to modify files without plan approval

**Solution**: This is expected behavior. Review the execution plan when presented and type `Y` to approve.

### Problem: High costs

**Check configuration**:
```env
# Use lightweight model for sub-agents
AI_SUBAGENT_MODEL=gemini-3.1-flash-lite-preview
```

**Analyze usage**:
```bash
npm run analyze-costs
```

---

## Next Steps

### Level 1: Try Examples ✅

Work through the vulnerable API example:
```bash
cd examples/vulnerable-api
cat README.md
# Follow the instructions
```

### Level 2: Real Project ✅

Run on your own codebase:
```bash
cd /path/to/your/project
sintenel "Scan for SQL injection and hardcoded secrets"
```

### Level 3: Customize ✅

Edit agent behaviors:
- `src/agents/orchestrator.ts` - Planning strategy
- `src/agents/scout.ts` - Reconnaissance focus
- `src/agents/fixer.ts` - Remediation approach

### Level 4: Contribute ✅

See [CONTRIBUTING.md](CONTRIBUTING.md):
- Report bugs
- Add detection patterns
- Improve documentation
- Submit examples

---

## Best Practices

### ✅ DO

- **Start small**: Test on example project first
- **Review plans**: Understand what will happen before approving
- **Use version control**: Git allows easy rollback
- **Enable backups**: Use `backupExisting: true`
- **Check audit logs**: Review after sessions
- **Narrow scope**: Target specific directories

### ❌ DON'T

- **Don't skip approval**: The gate exists for safety
- **Don't use on production without testing**: Try on staging first
- **Don't commit `.env`**: Keep API keys secret
- **Don't ignore risks**: If plan shows high risks, proceed cautiously
- **Don't disable auditing**: Logs are critical for debugging

---

## Success Criteria

You're ready to use Sintenel-CLI in production when:

- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] API key configured (`.env`)
- [ ] Completed example workflow
- [ ] Reviewed audit log (`sentinel-audit.log`)
- [ ] Understand approval process
- [ ] Read security best practices

---

## Getting Help

### Documentation
1. Check [FAQ.md](FAQ.md)
2. Review [FEATURES.md](FEATURES.md)
3. Read [ARCHITECTURE.md](ARCHITECTURE.md)

### Community
1. [GitHub Discussions](https://github.com/yourusername/sintenel-cli/discussions)
2. [Discord](https://discord.gg/sintenel)
3. [Twitter](https://twitter.com/sintenelcli)

### Issues
1. Search [existing issues](https://github.com/yourusername/sintenel-cli/issues)
2. Create new issue with template

---

**Welcome to Sintenel-CLI! You're now equipped to automate security remediation. 🚀**

**Next**: Try [examples/vulnerable-api](examples/vulnerable-api/README.md)
