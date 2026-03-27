# Changelog

All notable changes to Sintenel-CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-26

### Added

#### Core Features
- Multi-agent orchestration system (Orchestrator, Scout, Fixer)
- Human-in-the-loop execution plan approval
- Tamper-evident hash-chained audit logging with HMAC signing
- Policy-as-code command control (allow/deny lists)
- Advanced file operations (read, write, patch, delete, rename)
- Cross-platform shell execution (bash/PowerShell auto-detection)

#### Security
- Path traversal prevention with symlink escape detection
- Absolute and UNC path blocking
- Binary file detection
- Size limits (10MB read, 5MB write)
- Role-based permissions (Scout read-only, Fixer write-after-approval)
- Command policy evaluation before execution

#### Cost Optimization
- Tiered model strategy (75% cost reduction)
- Token limits (4096 orchestrator, 2048 sub-agents)
- Context pruning after 15 messages
- Early loop detection
- Concise system prompts (85 tokens)

#### UX/UI
- Production-grade TUI with spinners, progress bars, and tables
- Colored agent-specific output
- Token usage stats display
- Cost estimation per session

#### Testing
- 45 comprehensive tests (unit + integration)
- 64% code coverage
- CI/CD pipeline with cross-platform matrix
- Vitest test framework

#### Documentation
- Professional README with badges
- Getting started guide
- Real-world examples (vulnerable API)
- Competitive analysis
- Cost optimization guide
- Architecture overview
- Feature showcase
- Contributing guide
- Demo script
- MIT License

#### Examples & Tools
- Vulnerable API example (before/after)
- Benchmark script comparing vs competitors
- Cost analysis script for audit logs

### Changed
- N/A (initial release)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- Comprehensive path security implementation
- Command policy enforcement
- Audit trail integrity verification

---

## [Unreleased]

### Planned for 0.2.0

#### Security Integration
- [ ] CVE database integration
- [ ] OWASP Top 10 detection patterns
- [ ] SAST tool integration (Semgrep, Bandit)
- [ ] CWE classification support
- [ ] Vulnerability severity scoring (CVSS)

#### UX Improvements
- [ ] Interactive mode (continuous conversation)
- [ ] Progress streaming for long operations
- [ ] File diff preview before patching
- [ ] Undo/redo support

#### Testing
- [ ] Increase coverage to 85%
- [ ] Add E2E tests with real LLM calls
- [ ] Performance regression tests

### Planned for 0.3.0

#### Enterprise Features
- [ ] Web dashboard for audit visualization
- [ ] Team collaboration (shared policy libraries)
- [ ] SSO integration (OAuth, SAML)
- [ ] Slack/Teams notifications
- [ ] Metrics & analytics dashboard

#### Platform
- [ ] Docker container support
- [ ] Kubernetes operator
- [ ] REST API for integrations
- [ ] Webhook support

### Planned for 1.0.0

#### Platform Maturity
- [ ] Plugin marketplace
- [ ] Custom agent training
- [ ] Multi-language support (Python, Java, Go)
- [ ] SaaS offering
- [ ] Enterprise support packages

---

## Release Notes Format

### Version X.Y.Z - YYYY-MM-DD

**Highlights**: Brief description of major changes

#### Added
- New features

#### Changed
- Modifications to existing features

#### Fixed
- Bug fixes

#### Security
- Security patches

---

## Migration Guides

### Upgrading from 0.0.x to 0.1.0

No breaking changes (initial release).

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2026-03-26 | Initial release with multi-agent orchestration |

---

**Note**: For detailed changes, see [commit history](https://github.com/yourusername/sintenel-cli/commits).
