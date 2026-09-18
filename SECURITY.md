# Security Policy

## Local Security Architecture & Model

Workflow PR Viewer operates as a **local-first web application**. It runs on your workstation (`localhost`) and interfaces directly with local terminal processes, Git worktrees, and the GitHub REST API using your local access tokens.

The bundled `dev` and `start` commands bind to `127.0.0.1`. Workflow has no user authentication system, so do not expose it on a LAN, public interface, reverse proxy, or hosted platform without adding authentication and authorization first. Write operations are restricted to repositories listed in the local monitored-repository configuration.

### Security Guards Implemented

1. **CSRF & Origin Verification**: API endpoints enforce strict local origin verification ([`src/lib/security.ts`](src/lib/security.ts)) to block unauthorized cross-origin requests from external web pages.
2. **Shell Injection Prevention**: Branch names are allowlisted, local paths must be existing absolute directories, and Git/worktree operations use argument arrays instead of interpolated shell commands. Values embedded in AppleScript are escaped via [`escapeAppleScriptString`](src/lib/security.ts).
3. **Local Credentials Protection**: Secrets such as `GITHUB_TOKEN` are stored locally and never transmitted to third-party tracking or remote telemetry servers. If entered through the settings UI, the token is written to `.workflow-data/config.json` with owner-only (`0600`) permissions; this is local plaintext storage protected by the operating system account, not encryption. Use `.env.local` and do not share either file.

---

## Reporting Vulnerabilities

If you discover a potential vulnerability, use GitHub's private vulnerability reporting for this repository. Do not disclose tokens, local paths, exploit details, or proof-of-concept code in a public issue.

Include a detailed description, affected version or commit, reproduction steps, impact, and a minimal safe proof of concept.

We aim to respond to security reports within 48 hours and release fixes promptly.
