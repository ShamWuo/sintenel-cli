# Vulnerable API Example

This example demonstrates how Sintenel-CLI identifies and remediates common web API vulnerabilities.

## Vulnerabilities Present (BEFORE)

1. **SQL Injection** (CWE-89)
   - User input directly interpolated into SQL queries
   - Affects `/users/:id` and `/search` endpoints
   - **Risk**: Critical - Full database access

2. **Command Injection** (CWE-78)
   - User input passed to shell command without validation
   - Affects `/backup` endpoint
   - **Risk**: Critical - Remote code execution

3. **Hardcoded Credentials** (CWE-798)
   - Database password stored in source code
   - **Risk**: High - Credential exposure via version control

4. **CORS Misconfiguration** (CWE-942)
   - Wildcard origin with credentials enabled
   - **Risk**: Medium - CSRF attacks possible

## Running Sintenel-CLI

```bash
# Copy the vulnerable example
cp examples/vulnerable-api/server-before.ts src/server.ts

# Run Sintenel-CLI
sintenel "Audit src/server.ts for security vulnerabilities and apply fixes"
```

## Expected Execution Plan

```
Purpose                        Command
Scan for SQL patterns         Get-Content src/server.ts
Check for secrets             Select-String -Pattern "password|key|secret" src/server.ts
Analyze CORS config           Select-String -Pattern "cors|Access-Control" src/server.ts
```

## Remediation Applied (AFTER)

1. ✅ **SQL Injection Fixed**
   - Replaced string interpolation with parameterized queries
   - Used `mysql2/promise` with `execute()` method
   - Added input validation

2. ✅ **Command Injection Fixed**
   - Added strict regex validation (`/^[a-zA-Z0-9-]+$/`)
   - Rejected any filename with special characters
   - Prevented shell expansion

3. ✅ **Credentials Externalized**
   - Moved to environment variables
   - Created `.env.example` template
   - Added `.env` to `.gitignore`

4. ✅ **CORS Restricted**
   - Replaced `*` with origin whitelist
   - Validates against `ALLOWED_ORIGINS` env var
   - Only reflects allowed origins

## Verification

Run these commands to verify the fixes:

```bash
# Check for SQL injection patterns
grep -r "SELECT.*\${" src/

# Check for hardcoded secrets
grep -ri "password.*=.*['\"]" src/

# Verify parameterized queries
grep -r "execute(" src/
```

## Impact

- **Before**: 4 critical/high vulnerabilities
- **After**: 0 vulnerabilities, production-ready
- **Time**: ~60 seconds with human approval
- **Cost**: ~$0.002
