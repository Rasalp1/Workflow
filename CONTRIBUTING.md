# Contributing to Workflow

Thanks for contributing. Workflow launches local developer tools and can act on GitHub pull requests, so changes should preserve its local-first security model.

## Before opening a pull request

1. Copy `.env.local.example` to `.env.local`; never commit a token or local repository path.
2. Install the locked dependencies with `npm ci`.
3. Run `npm run lint`, `npm test`, and `npm run build`.
4. Add or update tests for behavior changes, especially changes that launch processes, create worktrees, or call GitHub APIs.

## Pull requests

Keep pull requests focused and explain any security, permissions, or local-data implications. Report vulnerabilities through the process in [SECURITY.md](SECURITY.md), not a public issue.
