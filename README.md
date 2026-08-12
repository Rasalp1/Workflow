# ⚡ Workflow PR Viewer

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge)

<p align="center">
  <b>A local-first, developer-centric PR management dashboard & CLI AI agent dispatcher.</b>
  <br />
  Streamline pull request code reviews, automate review readiness evaluation with customizable logic gates, and spawn AI coding agents (Codex, Claude, Cursor) directly inside local Git worktrees.
</p>

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Directory Hierarchy](#-architecture--directory-hierarchy)
- [System Prerequisites](#-system-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
- [Environment Configuration](#-environment-configuration)
- [Rules Engine ("Logic Gates")](#-rules-engine-logic-gates)
- [Terminal AI Agent & Worktree Dispatcher](#-terminal-ai-agent--worktree-dispatcher)
- [API Reference](#-api-reference)
- [Security & Local Isolation Model](#-security--local-isolation-model)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

Reviewing multiple pull requests across fast-moving repositories creates immense context-switching overhead. Developers routinely jump between GitHub's web interface, local terminal windows, branch checkouts, and AI coding assistants.

**Workflow PR Viewer** bridges your web browser and local development environment:
1. **Unified Dual-Column Feed**: Monitor pull requests across multiple repositories concurrently with independent scrolling columns and instant repository filtering.
2. **Automated Logic Gates**: Define custom evaluation rules (e.g., *"Is the PR author myself, and did someone else leave the last review comment?"*) to immediately flag actionable PRs.
3. **Seamless AI Agent Dispatching**: Launch CLI agents (`codex`, `claude`, `cursor`, etc.) pre-loaded with contextual prompts targeting specific PR branches.
4. **One-Click Git Worktree Isolation**: Resolve merge conflicts or review complex branch changes in an isolated Git worktree workspace without dirtying your main local working tree.

---

## ✨ Key Features

### 🔀 Dual-Column Independent Scrolling Layout
- **Multi-Repo Monitoring**: Filter Column 1 and Column 2 to specific repositories or view `ALL` monitored repos.
- **Scroll Syncing**: Active PR sidebar indicator dynamically highlights the visible PR card as you scroll.
- **Smart PR Prioritization**: PRs requiring your action (where you are not the latest commenter) are automatically surfaced at the top of the feed.

### 🧠 Logic Gates Rules Engine
- **Custom Expression Evaluator**: Write rules matching PR state, author identity, latest commenter, CI build status, and merge conflict status.
- **Action Triggers**: Automatically prompt or dispatch agent workflows when rules evaluate to `true`.
- **Dynamic Prompt Formatting**: Inject template placeholders (`{pr_number}`, `{author}`, `{branch}`, `{local_path}`) dynamically into AI agent prompts.

### 🖥️ Native macOS Terminal & IDE Integrations
- **Antigravity IDE & macOS Terminal Dispatcher**: Spawns a dedicated terminal tab or window focused on the target repository folder via native AppleScript execution.
- **Git Worktree Manager**: Automatically creates worktrees at `../worktrees/<branch-slug>` and navigates the IDE terminal directly to the branch.

### 💬 Rich Markdown & Comment Threading
- **Full GFM Support**: Renders GitHub Flavored Markdown, code blocks, tables, task lists, and issue references.
- **Inline Comment Replying**: Post review comments directly back to GitHub PR threads from the dashboard UI.

---

## 🏗 Architecture & Directory Hierarchy

Workflow PR Viewer is built on Next.js 16 (App Router), React 19, TailwindCSS 4, and Lucide Icons.

```
Workflow/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI workflow (lint, test, build)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/spawn/       # API route: Launch CLI agent in terminal
│   │   │   ├── config/            # API route: Read application config
│   │   │   ├── prs/               # API route: Fetch GitHub PRs & post comments
│   │   │   ├── rules/             # API route: Read/Write Logic Gate rules
│   │   │   └── worktree/spawn/    # API route: Spawn Git worktree & focus IDE
│   │   ├── globals.css            # Custom CSS & design system tokens
│   │   ├── layout.tsx             # Root App layout
│   │   └── page.tsx               # Main dual-column PR dashboard & sidebar
│   ├── components/
│   │   ├── Header.tsx             # App header with sync & modal triggers
│   │   ├── MarkdownRenderer.tsx   # React Markdown renderer with GFM & breaks
│   │   ├── PRCard.tsx             # PR Card component with CI, worktree, & rules
│   │   ├── PRSidebar.tsx          # Quick-jump navigation sidebar
│   │   ├── PromptModal.tsx        # AI agent prompt preview & composer modal
│   │   ├── RulesEditorModal.tsx   # Visual rules editor modal
│   │   └── SettingsModal.tsx      # App settings & agent configuration modal
│   ├── lib/
│   │   ├── __tests__/             # Unit tests (logic gates & security)
│   │   ├── github.ts              # GitHub REST API client & comment fetcher
│   │   ├── logicGates.ts          # Logic Gates expression parsing & evaluation
│   │   ├── security.ts            # Input sanitization & CSRF origin guards
│   │   ├── storage.ts             # Local JSON persistence (.workflow-data/)
│   │   └── terminalLauncher.ts    # AppleScript execution & worktree manager
│   └── types/
│       └── index.ts               # Shared TypeScript interfaces & types
├── .env.local.example             # Example environment variable file
├── CONTRIBUTING.md                # Open source contribution guidelines
├── LICENSE                        # MIT License
├── package.json                   # Project dependencies & scripts
└── README.md                      # Documentation
```

---

## 📋 System Prerequisites

| Requirement | Details |
| :--- | :--- |
| **Operating System** | **macOS** (Required for AppleScript IDE & Terminal launching) |
| **Node.js** | **v20.0.0** or higher |
| **Package Manager** | **npm** (v10+) |
| **GitHub Access Token** | Personal Access Token with `repo` scope |
| **CLI AI Agents (Optional)** | Installed CLI binaries (`codex`, `claude`, `cursor`, etc.) |

---

## 🚀 Quick Start Guide

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/workflow.git
cd workflow
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Edit `.env.local` with your GitHub token and local repository paths (see [Environment Configuration](#-environment-configuration)).

### Step 4: Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ⚙️ Environment Configuration

Configuration is managed via `.env.local` in the project root:

```env
# 1. GitHub Personal Access Token (Requires 'repo' scope)
GITHUB_TOKEN=ghp_your_github_personal_access_token_here

# 2. Default CLI Agent Executable ("codex", "claude", "cursor", etc.)
DEFAULT_AGENT=codex

# 3. Monitored Repositories (Comma-separated 'owner/repo' format)
MONITORED_REPOS=owner/repo-one,owner/repo-two

# 4. Local Repository Path Mappings (Format: REPO_PATH_<SANITIZED_REPO_NAME>)
# Note: Transform owner/repo by converting hyphens/slashes to underscores and uppercasing.
# Example for "owner/repo-one":
REPO_PATH_OWNER_REPO_ONE="/Users/username/Projects/repo-one"

# Example for "owner/repo-two":
REPO_PATH_OWNER_REPO_TWO="/Users/username/Projects/repo-two"
```

> [!TIP]
> **How to derive repo path variable names**:
> For repository `my-org/cool-project`, replace `-` and `/` with `_`, convert to uppercase, and prefix with `REPO_PATH_`:
> `REPO_PATH_MY_ORG_COOL_PROJECT="/path/to/local/cool-project"`

---

## ⚙️ Rules Engine ("Logic Gates")

The Rules Engine (`src/lib/logicGates.ts`) allows you to define conditional logic rules evaluated against every pull request.

### Rule Schema Definition

```typescript
export interface LogicGateRule {
  id: string;
  name: string;
  expression: string; // Evaluation expression
  action: 'AUTO_LAUNCH' | 'PROMPT_REVIEW';
  promptTemplate: string;
  enabled: boolean;
}
```

### Available Expression Variables

| Variable | Type | Description |
| :--- | :--- | :--- |
| `is_author` | `boolean` | `true` if current user matches PR author |
| `last_commenter_is_author` | `boolean` | `true` if PR author left the latest comment |
| `ci_status` | `string` | `'success'`, `'failure'`, or `'pending'` |
| `has_conflicts` | `boolean` | `true` if branch has merge conflicts against base |
| `comment_count` | `number` | Total number of discussion comments on PR |

### Expression Syntax Example

```javascript
// Rule: Trigger review if author is currentUser and someone else replied last
is_author == true && last_commenter_is_author == false && ci_status == 'success'
```

### Template Prompt Placeholders

Prompts support dynamic interpolation variables:

```text
Please review PR #{pr_number} on branch {branch} in local path {local_path}.
Author @{author} has responded to feedback. Address any open review points.
```

- `{pr_number}` — Pull Request number (e.g. `42`)
- `{author}` — GitHub handle of PR author
- `{branch}` — Head branch name
- `{repo}` — Repository full name (`owner/repo`)
- `{local_path}` — Mapped local disk directory path

---

## 🖥️ Terminal AI Agent & Worktree Dispatcher

Workflow PR Viewer integrates natively with macOS to open terminal tabs and focus IDE windows via AppleScript ([`src/lib/terminalLauncher.ts`](src/lib/terminalLauncher.ts)).

### Worktree Workflow
When you click **"Resolve via Worktree"** on a PR card:
1. **Branch Sanitization**: Validates branch name safety to prevent shell injection.
2. **Worktree Directory**: Creates a worktree at `<parent-dir>/worktrees/<branch-slug>`.
3. **IDE Focus**: Activates Antigravity IDE (or macOS Terminal), creates a fresh terminal tab, and executes `cd "<worktreePath>"`.

### Granting macOS Accessibility Permissions

To allow AppleScript keystrokes (opening terminal tabs in IDE windows), grant your terminal app Accessibility access:
1. Open **System Settings** -> **Privacy & Security** -> **Accessibility**.
2. Enable your terminal application (e.g. `Terminal`, `iTerm2`, `Antigravity IDE`, `VS Code`).

---

## 🔌 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/prs` | `GET` | Fetches open PRs, comments, and CI statuses from GitHub API. |
| `/api/prs/comment` | `POST` | Posts a new comment to a specified PR thread. |
| `/api/agent/spawn` | `POST` | Launches a CLI agent (`codex`, `claude`) in terminal pre-loaded with prompt. |
| `/api/worktree/spawn` | `POST` | Spawns Git worktree for branch and opens terminal in IDE. |
| `/api/rules` | `GET` / `POST` | Fetches or updates stored Logic Gate rules. |
| `/api/config` | `GET` | Reads current application configuration & monitored repos. |

---

## 🛡️ Security & Local Isolation Model

Workflow PR Viewer is designed as a secure **local-first app**:

1. **CSRF & Origin Protection**: All API endpoints verify origin headers via [`validateOrigin`](src/lib/security.ts#L49) to ensure requests originate exclusively from `localhost` / `127.0.0.1`.
2. **Shell Injection Prevention**: Branch names and local paths pass through strict regular expression filters ([`sanitizeBranchName`](src/lib/security.ts#L8) & [`validateLocalPath`](src/lib/security.ts#L32)).
3. **Local Credentials Only**: Your `GITHUB_TOKEN` remains on your local disk in `.env.local` and is never sent to external servers.

---

## ❓ Troubleshooting & FAQ

#### Q: `npm run lint` fails or shows warnings?
**A**: Ensure all dependencies are installed cleanly via `npm ci`. Run `npm run lint` to verify zero errors and zero warnings.

#### Q: AppleScript error: "Not allowed to send keystrokes"?
**A**: Grant Accessibility permission to your terminal / IDE in **System Settings -> Privacy & Security -> Accessibility**.

#### Q: "Local directory does not exist on disk" error when spawning worktree?
**A**: Verify that the corresponding `REPO_PATH_<SANITIZED_NAME>` variable in `.env.local` points to a valid existing path on your Mac.

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on setting up your local environment, running tests (`npm test`), and submitting pull requests.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
