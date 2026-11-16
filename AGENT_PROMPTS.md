# AI Agent Action Prompts

This document contains the complete prompts and templates configured for all agent actions in the Workflow PR Viewer dashboard.

---

## Table of Contents

- [Agent Actions (`spawn_agent`)](#agent-actions-spawn_agent)
  - [1. Review (Initial Code Review)](#1-review-initial-code-review)
  - [2. OpenCode Review (Alibaba OCR / Luna)](#2-opencode-review-alibaba-ocr--luna)
  - [3. Review Light (Critical Blockers Scan)](#3-review-light-critical-blockers-scan)
  - [4. Review With Context (Full Historical Review)](#4-review-with-context-full-historical-review)
  - [5. Review Recent Comment (Focused Incremental Review)](#5-review-recent-comment-focused-incremental-review)
  - [6. Address Review Issues (Full Backlog)](#6-address-review-issues-full-backlog)
  - [7. Address Recent Comment (Single Comment Focus)](#7-address-recent-comment-single-comment-focus)
  - [8. Solve Conflicts (Merge Conflict Resolution)](#8-solve-conflicts-merge-conflict-resolution)
- [Automated Non-Agent Actions](#automated-non-agent-actions)
  - [9. Author: Solve conflicts (`post_comment`)](#9-author-solve-conflicts-post_comment)
  - [10. Convert Draft to Open PR (`undraft_pr`)](#10-convert-draft-to-open-pr-undraft_pr)
- [Available Template Variables](#available-template-variables)

---

## Agent Actions (`spawn_agent`)

These actions open a Git worktree and dispatch a CLI AI agent (such as Codex, Claude, or OCR) with the generated prompt.

---

### 1. Review (Initial Code Review)

- **Rule ID**: `code-review`
- **Button Label**: `Review`
- **Icon**: `Eye` (emerald)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `prOwnedByNonCurrentUser`: Pull request is authored by someone else
  - `hasNoComments`: No comments recorded yet

#### Complete Prompt Template

```markdown
Perform extensive and deep code review on this branch against branch {base_branch}. Consider all aspects. 
 ## Role

You're a senior software engineer conducting a thorough code review. Provide constructive, actionable feedback.

## Review Areas

Analyze the selected code for:

1. **Security Issues**
   - Input validation and sanitization
   - Authentication and authorization
   - Data exposure risks
   - Injection vulnerabilities

2. **Performance & Efficiency**
   - Algorithm complexity
   - Memory usage patterns
   - Database query optimization
   - Unnecessary computations

3. **Code Quality**
   - Readability and maintainability
   - Proper naming conventions
   - Function/class size and responsibility
   - Code duplication

4. **Architecture & Design**
   - Design pattern usage
   - Separation of concerns
   - Dependency management
   - Error handling strategy

5. **Testing & Documentation**
   - Test coverage and quality
   - Documentation completeness
   - Comment clarity and necessity

## Output Format

Provide feedback as:

**[Critical Issues]** - Must fix before merge
**[Suggestions]** - Improvements to consider
**[Good Practices]** - What's done well

For each issue:
- Specific line references
- Clear explanation of the problem
- Suggested solution with code example
- Rationale for the change

## Publish Review Comment

When you have completed your review, post your findings as a comment on PR #{pr_number}. Ensure you use the correct review comment type:
- Request changes if changes or fixes are needed before merging.
- Approve otherwise if the pull request looks good and is ready to merge.
```

---

### 2. OpenCode Review (Alibaba OCR / Luna)

- **Rule ID**: `opencode-review`
- **Button Label**: `OpenCode Review`
- **Icon**: `Eye` (indigo)
- **Agent Override**: `ocr` (Alibaba OpenCodeReview)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `prOwnedByNonCurrentUser`: Pull request authored by someone else
  - `hasNoComments`: No comments recorded yet

#### Complete Prompt Template

```markdown
PR #{pr_number}: {pr_title}

### PR Description
{pr_body}

Review code changes against base branch '{base_branch}'. Verify correctness, edge cases, safety, performance, and adherence to requirements.
```

---

### 3. Review Light (Critical Blockers Scan)

- **Rule ID**: `review-light`
- **Button Label**: `Review Light`
- **Icon**: `Eye` (emerald)
- **Agent**: Default CLI Agent (`codex` / `claude`)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `prOwnedByNonCurrentUser`: PR authored by someone else
  - `notReviewedByOthers`: Not handled by 2 other consecutive reviewers

#### Complete Prompt Template

```markdown
Perform a lightweight code review on PR #{pr_number} ({pr_title}) against branch {base_branch}.

## Role & Review Focus
You are a senior software engineer conducting a fast, high-signal, lightweight code review.
Do NOT focus on minor nitpicks, stylistic nuances, code formatting, or trivial suggestions.

Your review has two strict goals:
1. **Critical Merge Blockers**: Scan specifically and solely for absolutely critical merge blockers. This includes:
   - Fatal bugs, logic errors, or crashes/unhandled exceptions
   - Severe security vulnerabilities or sensitive data exposure
   - Data corruption, data loss, or broken database integrity
   - Breaking changes or critical regressions that prevent merging
2. **Requirements Verification**: Check whether the PR requirements and core intentions have been addressed by the author.

## Decision & Publish Review Comment
When your review is complete, publish your review on PR #{pr_number}:
- **If any critical merge blockers are found**: Submit a "REQUEST_CHANGES" review comment detailing each critical blocker, specific line references, and the necessary fix before this can be merged.
- **If NO critical merge blockers are found AND the requirements have been addressed by the author**: Recommend approval by submitting an "APPROVE" review comment confirming that the core requirements are met and there are no critical blockers.
```

---

### 4. Review With Context (Full Historical Review)

- **Rule ID**: `review-with-context`
- **Button Label**: `Review with context`
- **Icon**: `Eye` (emerald)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `prOwnedByNonCurrentUser`: PR authored by someone else
  - `lastCommentNotCurrentUser`: Latest human comment from author/another user
  - `notReviewedByOthers`: Not handled by 2 other consecutive reviewers

#### Complete Prompt Template

```markdown
Look at the complete comment history on the pr that exists on this branch, PR #{pr_number}. We’re the reviewer. Has the author adressed all the issues we identified? Are there any new issues that have been created? Is the author pushing back on anything we’ve said in a previous review? Why? Do they do so rightfully, or is their pushback not justified? Do a complete code review of this PR. Think long and hard to verify that the claimed fixes are in place, and try to find any new issues that have arisen, and try to find unrelated issues on this PR that were missed before! When you’ve completed your code review, publish a "changes requested" comment type on the PR with your detailed feedback if you do find changes. Otherwise, published an approved review explaining why it's approved. 
```

---

### 5. Review Recent Comment (Focused Incremental Review)

- **Rule ID**: `review-latest-comment`
- **Button Label**: `Review Latest`
- **Icon**: `Eye` (emerald)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `prOwnedByNonCurrentUser`: PR authored by someone else
  - `lastCommentNotCurrentUser`: Latest comment from author
  - `notReviewedByOthers`: Not handled by 2 other consecutive reviewers

#### Complete Prompt Template

```markdown
Review PR #{pr_number} ({pr_title}) against branch {base_branch}, focusing specifically on the author’s recentmost response by @{last_comment_author}:

"{last_comment_body}"

We’re the reviewer. Instead of re-evaluating the full PR comment history, focus specifically on this latest update and comment. Has the author addressed the specific points raised in the review? Are the claimed fixes in place in the code, or are they pushing back? If they are pushing back, why? Are they doing so rightfully or not? Conduct a focused code review on this update and publish a "changes requested" or "approve" review comment on the PR with clear, constructive feedback.
```

---

### 6. Address Review Issues (Full Backlog)

- **Rule ID**: `address-issues`
- **Button Label**: `Address Issues`
- **Icon**: `Wrench` (purple)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `prOwnedByCurrentUser`: You own the pull request
  - `lastCommentNotCurrentUser`: Reviewer posted new feedback

#### Complete Prompt Template

```markdown
Address review issues for PR #{pr_number} 

Look at the complete comment history on the pr that exists on this branch. Read it all, and then adress the reviewers recentmost feedback with the whole context of the PR in mind. Check the issues the reviewer has raised against the code. Fix the issues if they're real- but don’t trust the reviewer blindly. Check if the issues exist in the code. If they do NOT, or if it’s a design decision- Don’t be afraid to push back. If you DO decide to adress the issues, do it very thoroughly and with great effort and detail. Before you start implementing, think of the best fix really hard. Is it the optimal way to do it? Once you’re done, push the changes to the branch and post a very detailed comment to the pr explaining what you did and why. 
```

---

### 7. Address Recent Comment (Single Comment Focus)

- **Rule ID**: `address-latest-comment`
- **Button Label**: `Address Latest`
- **Icon**: `Wrench` (purple)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `prOwnedByCurrentUser`: You own the pull request
  - `lastCommentNotCurrentUser`: Latest comment from reviewer

#### Complete Prompt Template

```markdown
Address review feedback on PR #{pr_number} ({pr_title}) based ONLY on the recentmost comment by @{last_comment_author}:

"{last_comment_body}"

Focus specifically and solely on addressing the issues and feedback raised in this most recent comment, without getting distracted by previous conversation history. Check the issues raised against the code. Fix the issues if they're real- but don’t trust the reviewer blindly. Check if the issues exist in the code. If they do NOT, or if it’s a design decision- Don’t be afraid to push back. If you DO decide to address the issues, do it very thoroughly and with great effort and detail. Before you start implementing, think of the best fix really hard. Is it the optimal way to do it? Once you’re done, push the changes to the branch and post a clear comment to the PR explaining what you did and why.
```

---

### 8. Solve Conflicts (Merge Conflict Resolution)

- **Rule ID**: `rebase-user-pr`
- **Button Label**: `Solve conflicts`
- **Icon**: `GitBranch` (amber)
- **Action Type**: `spawn_agent`
- **Trigger Conditions**:
  - `hasMergeConflicts`: PR has merge conflicts or `mergeable_state === 'dirty'` (available on any PR with conflicts)

#### Complete Prompt Template

```markdown
Solve conflicts against {base_branch} for PR #{pr_number} ({pr_title}) in repository {repo_name} on branch '{branch}'.

Fetch origin and merge origin/{base_branch} into '{branch}'. Solve conflicts and any issues the best way you can. Don't look at only git-identified conflicts, but also at structural intention. Take a step back and assess the codebase as a whole. Does anything break with the merge? Are any intentions, from either side, lost? Verify clean test execution.

Only resort to rebasing (git rebase origin/{base_branch}) if merging does not work or if nothing else works.

Once you’re done, push the changes to the branch (only force push if you had to resort to rebasing) and post a comment on the PR explaining how conflicts were resolved.
```

---

## Automated Non-Agent Actions

These actions do not launch CLI agents; they trigger direct GitHub API calls from the dashboard.

### 9. Author: Solve conflicts (`post_comment`)

- **Rule ID**: `rebase-non-user-pr`
- **Button Label**: `Author: Solve conflicts`
- **Icon**: `GitBranch` (amber)
- **Action Type**: `post_comment`
- **Trigger Conditions**:
  - `prOwnedByNonCurrentUser`: PR owned by someone else
  - `hasMergeConflicts`: PR has merge conflicts
- **Comment Text**:
  ```markdown
  @{author} Please solve merge conflicts against target branch.
  ```

### 10. Convert Draft to Open PR (`undraft_pr`)

- **Rule ID**: `convert-draft-to-ready`
- **Button Label**: `Convert PR`
- **Icon**: `GitPullRequest` (blue)
- **Action Type**: `undraft_pr`
- **Trigger Conditions**:
  - `isDraft`: Pull request is in draft mode
- **Prompt Template**:
  ```markdown
  Convert PR #{pr_number} ({pr_title}) from draft to open ready-for-review PR.
  ```

---

## Available Template Variables

When a gate executes, the prompt template is processed and all placeholders are dynamically populated:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `{pr_number}` | Pull Request number | `42` |
| `{pr_title}` | PR title string | `Add authentication layer` |
| `{pr_body}` | PR description markdown | `Fixes #12. Adds OAuth2 login flow.` |
| `{base_branch}` | Target branch for the merge | `main` |
| `{branch}` / `{head_branch}` | Source feature branch name | `feat/auth-layer` |
| `{repo_name}` | Repository name or full name | `org/project` |
| `{author}` | GitHub username of the PR author | `octocat` |
| `{last_comment_author}` | Author of the most recent human comment | `reviewer-jane` |
| `{last_comment_body}` | Body text of the most recent human comment | `"Please add a unit test for..."` |
| `{comments_summary}` | Aggregated list of all non-bot comments | `- @user (Comment): ...` |

