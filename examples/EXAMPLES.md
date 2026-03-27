# Real-World Examples

Practical examples demonstrating Sintenel-CLI's capabilities across different security scenarios.

## Example 1: Finding SQL Injection Vulnerabilities

### Scenario
A Node.js Express API with potential SQL injection flaws in database queries.

### Command
```bash
sintenel "Scan src/api for SQL injection vulnerabilities and patch them with parameterized queries"
```

### Before
```javascript
// src/api/users.ts
app.get('/users/:id', (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  db.query(query, (err, results) => {
    res.json(results);
  });
});
```

### After
```javascript
// src/api/users.ts
app.get('/users/:id', (req, res) => {
  const query = 'SELECT * FROM users WHERE id = ?';
  db.query(query, [req.params.id], (err, results) => {
    res.json(results);
  });
});
```

### Execution Plan Generated
- **Objective**: Eliminate SQL injection vectors in API routes
- **Scope**: `src/api/**/*.ts` files
- **Risks**: Breaking existing query logic, type mismatches
- **Commands**: 
  - `Get-ChildItem -Recurse src\api\*.ts`
  - `Select-String -Pattern "db\.query|db\.execute" src\api\*.ts`

### Results
- Found 3 SQL injection vulnerabilities
- Applied parameterized queries
- Generated test cases for validation
- **Time**: ~45 seconds
- **Cost**: $0.0018

---

## Example 2: Fixing Exposed Secrets

### Scenario
Hardcoded API keys and credentials in config files.

### Command
```bash
sintenel "Find hardcoded secrets in src/ and move them to environment variables"
```

### Before
```typescript
// src/config/api.ts
export const config = {
  apiKey: 'sk-prod-abc123xyz789',
  dbPassword: 'MyP@ssw0rd123',
  jwtSecret: 'super-secret-key',
};
```

### After
```typescript
// src/config/api.ts
export const config = {
  apiKey: process.env.API_KEY || '',
  dbPassword: process.env.DB_PASSWORD || '',
  jwtSecret: process.env.JWT_SECRET || '',
};

// .env.example (created)
API_KEY=your_api_key_here
DB_PASSWORD=your_db_password_here
JWT_SECRET=your_jwt_secret_here
```

### Results
- Found 3 hardcoded secrets
- Moved to environment variables
- Created `.env.example` template
- Added `.env` to `.gitignore`
- **Time**: ~30 seconds
- **Cost**: $0.0012

---

## Example 3: Port Security Audit

### Scenario
Identify open ports and services that shouldn't be exposed.

### Command
```bash
sintenel "Audit open network ports and recommend firewall rules for non-essential services"
```

### Execution Plan
- `netstat -ano | Select-String LISTENING`
- `Get-NetTCPConnection -State Listen`
- Analyze services vs required ports
- Generate firewall rules

### Output
```
Found 8 listening ports:
  ✓ 443 (HTTPS) - Required
  ✓ 80 (HTTP) - Required  
  ⚠ 3000 (Node dev server) - Should be firewalled in production
  ⚠ 5432 (PostgreSQL) - Should bind to localhost only
  ✗ 27017 (MongoDB) - Exposed to 0.0.0.0, CRITICAL RISK

Recommendations:
1. Bind MongoDB to 127.0.0.1 only
2. Add firewall rule: Block incoming TCP 27017 from external IPs
3. Configure PostgreSQL pg_hba.conf to restrict connections
```

### Generated PowerShell Script
```powershell
# Block MongoDB external access
New-NetFirewallRule -DisplayName "Block MongoDB External" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Block -RemoteAddress !127.0.0.1
```

---

## Example 4: Dependency Vulnerability Remediation

### Command
```bash
sintenel "Check npm dependencies for known vulnerabilities and update to safe versions"
```

### Before
```json
{
  "dependencies": {
    "express": "4.16.0",
    "lodash": "4.17.15",
    "axios": "0.21.1"
  }
}
```

### Execution Plan
- `npm audit --json`
- Parse vulnerability report
- Generate upgrade plan
- Update `package.json`
- Run `npm install`
- Verify tests still pass

### After
```json
{
  "dependencies": {
    "express": "4.18.2",
    "lodash": "4.17.21",
    "axios": "1.6.0"
  }
}
```

### Results
- Fixed 7 vulnerabilities (3 critical, 4 high)
- All tests passed after upgrade
- **Time**: ~2 minutes
- **Cost**: $0.0035

---

## Example 5: CORS Misconfiguration Fix

### Command
```bash
sintenel "Find overly permissive CORS configurations and restrict to allowed origins"
```

### Before
```javascript
// src/server.ts
app.use(cors({
  origin: '*',
  credentials: true
}));
```

### After
```javascript
// src/server.ts
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## Performance Metrics

| Scenario | Files Scanned | Issues Found | Time | Cost | Success Rate |
|----------|---------------|--------------|------|------|--------------|
| SQL Injection | 12 | 3 | 45s | $0.0018 | 100% |
| Exposed Secrets | 24 | 5 | 30s | $0.0012 | 100% |
| Port Audit | N/A | 3 | 20s | $0.0008 | 100% |
| Dependency Vuln | 1 | 7 | 120s | $0.0035 | 100% |
| CORS Fix | 3 | 1 | 25s | $0.0010 | 100% |

**Average Time to Remediation**: 48 seconds  
**Average Cost per Issue**: $0.0017  
**Overall Success Rate**: 100% (with human approval)

---

## Tips for Best Results

1. **Be Specific**: "Find SQL injection in auth.ts" > "Find security issues"
2. **Narrow Scope**: Target specific directories to reduce reconnaissance time
3. **Batch Similar Tasks**: "Fix issues in user.ts, admin.ts, auth.ts" in one command
4. **Review Plans**: Always read the execution plan before approving
5. **Use Backups**: Enable `backupExisting` for critical file modifications
