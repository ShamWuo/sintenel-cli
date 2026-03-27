# Security Policy

## Reporting Security Vulnerabilities

**DO NOT** open public GitHub issues for security vulnerabilities.

### Private Disclosure

Email security reports to: **security@sintenel.dev** (replace with your actual email)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **24 hours**: Initial response confirming receipt
- **72 hours**: Assessment and severity classification
- **7 days**: Fix developed and tested
- **14 days**: Patch released and advisory published

### Bounty Program

We do not currently offer a bug bounty program, but we deeply appreciate responsible disclosure and will credit researchers in:
- Security advisories
- CHANGELOG.md
- Hall of Fame (once established)

---

## Supported Versions

| Version | Supported | Notes |
|---------|-----------|-------|
| 0.1.x   | ✅ Yes    | Current stable |
| < 0.1.0 | ❌ No     | Pre-release |

---

## Security Features

### 1. Path Security

**Protections**:
- ✅ Path traversal prevention (`../` blocking)
- ✅ Absolute path rejection
- ✅ UNC path blocking (`\\server\share`)
- ✅ Symlink escape detection
- ✅ Working directory boundary enforcement

**Implementation**: `src/utils/paths.ts`

**Tests**: 10 dedicated tests in `src/utils/paths.test.ts`

### 2. Command Execution Safety

**Protections**:
- ✅ Human approval required for all commands
- ✅ Command allow/deny list policy
- ✅ High-risk pattern detection (rm -rf, Format-Volume)
- ✅ 60-second timeout
- ✅ Output buffer limits (8MB)

**Implementation**: `src/policy/commandPolicy.ts`, `src/tools/executeShell.ts`

### 3. File Operation Safety

**Protections**:
- ✅ Binary file detection and rejection
- ✅ Size limits (10MB read, 5MB write)
- ✅ Automatic backup support
- ✅ Write permission checks
- ✅ Destructive operation flags

**Implementation**: `src/tools/fileOperator.ts`

### 4. Audit Integrity

**Protections**:
- ✅ Hash-chained entries (tamper detection)
- ✅ Optional HMAC signing (strong integrity)
- ✅ Sequential number verification
- ✅ Exportable signed bundles

**Implementation**: `src/utils/audit.ts`

### 5. Agent Isolation

**Protections**:
- ✅ Scout: Read-only access
- ✅ Fixer: Write access only after approval
- ✅ Orchestrator: No direct file/command access
- ✅ Tool-level permission enforcement

**Implementation**: `src/engine/agentManager.ts`

---

## Known Limitations

### Current Scope

1. **Windows PowerShell Focus**: Primary development on Windows
   - **Mitigation**: Cross-platform shell support added in 0.1.0
   
2. **File Size Limits**: 10MB read, 5MB write
   - **Rationale**: Prevents memory exhaustion and excessive token usage
   - **Workaround**: Process large files in chunks

3. **Single Session**: No persistent state across runs
   - **Mitigation**: Audit logs provide session history
   
4. **No Sandboxing**: Commands run with user privileges
   - **Mitigation**: Human approval gate, policy enforcement
   - **Roadmap**: Consider Docker/VM sandboxing in v0.3.0

### Security Assumptions

1. **Trusted LLM Provider**: Assumes Google/OpenAI/Anthropic APIs are secure
2. **Secure Transport**: API calls over HTTPS
3. **Local Environment**: Assumes host OS is not compromised
4. **Human Operator**: Assumes approval giver understands plans

---

## Security Best Practices

### For Users

1. **Review Plans Carefully**: Read execution plans before approving
2. **Enable HMAC Signing**: Set `SINTENEL_AUDIT_HMAC_KEY` in `.env`
3. **Use Strict Mode**: Enable `SINTENEL_STRICT_MODE=true`
4. **Limit Scope**: Use `-d` flag to restrict working directory
5. **Backup Critical Files**: Use `backupExisting: true` in plans
6. **Rotate API Keys**: Don't commit API keys to version control
7. **Review Audit Logs**: Check `sentinel-audit.log` after sessions

### For Developers

1. **Validate All Inputs**: Use Zod schemas for tool parameters
2. **Sanitize Paths**: Always use `resolveUnderRoot()`
3. **Check Permissions**: Verify `writeAllowed()`, `executionAllowed()`
4. **Log Everything**: Use `appendAuditLog()` for all actions
5. **Test Edge Cases**: Path traversal, oversized files, malformed input
6. **Fail Securely**: Default to deny, not allow
7. **Review Tool Descriptions**: Don't leak sensitive implementation details to LLM

---

## Secure Development Lifecycle

### Code Review

All PRs require:
- [ ] Security review (path handling, permissions)
- [ ] Test coverage for security paths
- [ ] No hardcoded secrets
- [ ] Audit logging implemented

### Dependency Management

- Monthly `npm audit` checks
- Automated Dependabot PRs
- Pin major versions
- Review dependency permissions

### Testing

- Unit tests for all security functions
- Integration tests for approval flows
- Fuzz testing for path handling (future)
- Penetration testing (future)

---

## Incident Response

### If You Discover a Vulnerability

1. **Assess Impact**: Who is affected? How severe?
2. **Contain**: Remove vulnerable code if possible
3. **Report**: Email security@sintenel.dev immediately
4. **Cooperate**: Work with maintainers on fix
5. **Disclose**: After patch is released (coordinated disclosure)

### If We Discover a Vulnerability

1. **Triage**: Severity classification (Critical/High/Medium/Low)
2. **Develop Fix**: Patch with tests
3. **Test**: Verify fix doesn't break functionality
4. **Release**: Emergency patch release
5. **Notify**: Security advisory on GitHub
6. **Disclose**: CVE assignment for critical issues

---

## Compliance & Standards

### Adherence

- **OWASP Top 10**: Tool designed to detect/fix OWASP issues
- **CWE**: Maps vulnerabilities to CWE IDs (roadmap)
- **NIST Cybersecurity Framework**: Aligns with Identify, Protect functions
- **SOC 2**: Audit logs support compliance evidence

### Certifications

- 🔄 SOC 2 Type 2 (planned for enterprise version)
- 🔄 ISO 27001 (planned)

---

## Security Contacts

- **General Security**: security@sintenel.dev
- **PGP Key**: [Available on request]
- **Security Advisories**: https://github.com/yourusername/sintenel-cli/security/advisories

---

## Hall of Fame

Security researchers who have responsibly disclosed vulnerabilities:

*No vulnerabilities reported yet (initial release)*

---

**Last Updated**: 2026-03-26  
**Security Policy Version**: 1.0
