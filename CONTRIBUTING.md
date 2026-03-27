# Contributing to Sintenel-CLI

Thank you for your interest in contributing! This guide will help you get started.

## Code of Conduct

- Be respectful and constructive
- Focus on technical merit
- Welcome newcomers
- Provide actionable feedback

## Development Setup

### 1. Fork & Clone

```bash
git clone https://github.com/yourusername/sintenel-cli.git
cd sintenel-cli
npm install
```

### 2. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

```bash
npm run dev -- "test your changes"
npm test
npm run build
```

### 4. Submit PR

```bash
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

## Project Structure

```
sintenel-cli/
├── src/
│   ├── agents/           # Agent system prompts
│   │   ├── orchestrator.ts
│   │   ├── scout.ts
│   │   └── fixer.ts
│   ├── engine/           # Core orchestration logic
│   │   └── agentManager.ts
│   ├── tools/            # Agent tools
│   │   ├── fileOperator.ts
│   │   ├── executePowerShell.ts
│   │   ├── executeShell.ts
│   │   └── submitExecutionPlan.ts
│   ├── utils/            # Utilities
│   │   ├── audit.ts
│   │   ├── paths.ts
│   │   ├── ui.ts
│   │   └── confirm.ts
│   ├── policy/           # Command policies
│   │   └── commandPolicy.ts
│   └── index.ts          # CLI entry point
├── examples/             # Real-world examples
├── scripts/              # Utility scripts
├── tests/                # Test files
└── docs/                 # Documentation
```

## Development Workflow

### Running Tests

```bash
# All tests
npm test

# Watch mode (recommended during development)
npm test:watch

# With coverage
npm test:coverage

# Specific test file
npx vitest src/tools/fileOperator.test.ts
```

### Type Checking

```bash
npm run typecheck
```

### Building

```bash
npm run build
```

## Contribution Areas

### 🐛 Bug Fixes

Found a bug? Great!

1. Check if an issue already exists
2. Create a test case that reproduces the bug
3. Fix the bug
4. Ensure all tests pass
5. Submit PR with test + fix

### ✨ New Features

Want to add a feature?

1. Open an issue first to discuss the approach
2. Write tests for the new functionality
3. Implement the feature
4. Update documentation
5. Submit PR

### 📚 Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add more examples
- Improve getting started guides
- Write tutorials

### 🧪 Testing

Help us reach 95% coverage:

- Add edge case tests
- Write integration tests
- Create performance benchmarks
- Test on different platforms (Linux, macOS, Windows)

### 🔐 Security Policies

Expand the policy library:

- Add detection patterns for CVEs
- Create remediation workflows
- Add command policies
- Test policies against real vulnerabilities

## Code Style

### TypeScript

- Use explicit types (avoid `any`)
- Prefer `const` over `let`
- Use async/await over promises
- Add JSDoc for public APIs

### Testing

- Write tests for new functionality
- Use descriptive test names: `it('should reject SQL injection patterns')`
- Test both success and error paths
- Mock external dependencies

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add CVE detection patterns
fix: prevent path traversal in fileOperator
docs: update getting started guide
test: add integration tests for scout agent
perf: optimize token usage in orchestrator
```

## Pull Request Process

### Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] Code builds (`npm run build`)
- [ ] Types are correct (`npm run typecheck`)
- [ ] Documentation updated
- [ ] Example added (if new feature)
- [ ] Changelog updated

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing performed

## Checklist
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Documentation updated
```

## Testing Guidelines

### Unit Tests

Test individual functions in isolation:

```typescript
describe('resolveUnderRoot', () => {
  it('should block path traversal', () => {
    expect(() => resolveUnderRoot('/root', '../escape')).toThrow();
  });
});
```

### Integration Tests

Test workflows across multiple components:

```typescript
describe('Multi-file remediation', () => {
  it('should fix vulnerabilities across project', async () => {
    // Setup vulnerable files
    // Run agent workflow
    // Verify all fixes applied
  });
});
```

### Edge Cases

Always test:
- Empty inputs
- Invalid paths
- Permission errors
- Network failures
- Large files
- Binary files
- Symlinks
- Path traversal attempts

## Review Process

1. **Automated Checks**: CI runs tests on Linux, Windows, macOS
2. **Code Review**: Maintainers review for quality, security, design
3. **Feedback**: Address comments, make requested changes
4. **Approval**: Two maintainer approvals required
5. **Merge**: Squash and merge to main

## Community

- **Discord**: [Join our community](https://discord.gg/sintenel)
- **Twitter**: [@SintenelCLI](https://twitter.com/sintenelcli)
- **Blog**: [dev.to/sintenel](https://dev.to/sintenel)

## Recognition

Contributors are recognized in:
- [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Release notes
- Project README

## Questions?

- **General Questions**: [GitHub Discussions](https://github.com/yourusername/sintenel-cli/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/yourusername/sintenel-cli/issues)
- **Security Issues**: security@sintenel.dev (private disclosure)

---

**Thank you for contributing to Sintenel-CLI!** 🚀
