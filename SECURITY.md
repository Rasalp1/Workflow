# Security Policy

## Local Security Architecture & Model

Workflow PR Viewer operates as a **local-first web application**. It runs on your workstation (`localhost`) and interfaces directly with local terminal processes, Git worktrees, and the GitHub REST API using your local access tokens.

### Security Guards Implemented

1. **CSRF & Origin Verification**: API endpoints enforce strict local origin verification ([`src/lib/security.ts`](src/lib/security.ts)) to block unauthorized cross-origin requests from external web pages.
2. **Shell Injection Prevention**: All branch names, directory paths, and command arguments sent to AppleScript or terminal execution are sanitized via [`sanitizeBranchName`](src/lib/security.ts) and [`validateLocalPath`](src/lib/security.ts).
3. **Local Credentials Protection**: Secrets such as `GITHUB_TOKEN` are stored strictly in `.env.local` on your local filesystem and are never transmitted to third-party tracking or remote telemetry servers.

---

## Reporting Vulnerabilities

If you discover a potential security vulnerability in Workflow PR Viewer, please report it responsibly:

- **Do NOT** open a public issue on GitHub.
- Email security reports to the project maintainers directly.
- Include a detailed description of the issue, steps to reproduce, and any relevant proof-of-concept code.

We aim to respond to security reports within 48 hours and release fixes promptly.
