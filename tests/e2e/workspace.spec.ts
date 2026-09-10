import { test, expect, type Page } from "@playwright/test";
import type { LogicalGateRule, PullRequest } from "../../src/types";

const user = {
  login: "alex",
  avatar_url: "",
  html_url: "https://github.com/alex",
};
const reviewer = { ...user, login: "sam" };
const rules: LogicalGateRule[] = [
  {
    id: "address-issues",
    name: "Address review feedback",
    description: "Respond to review feedback",
    enabled: true,
    buttonLabel: "Address issues",
    buttonColor: "purple",
    buttonIcon: "Wrench",
    actionType: "spawn_agent",
    conditions: { lastCommentNotCurrentUser: true },
    promptTemplate: "Address feedback for PR #{pr_number}.",
  },
  {
    id: "post-comment",
    name: "Reply to the discussion",
    description: "Post a comment",
    enabled: true,
    buttonLabel: "Reply on GitHub",
    buttonColor: "blue",
    buttonIcon: "Terminal",
    actionType: "post_comment",
    conditions: {},
    promptTemplate: "Thanks for the review.",
  },
  {
    id: "undraft",
    name: "Ready for review",
    description: "Open a draft",
    enabled: true,
    buttonLabel: "Ready for review",
    buttonColor: "blue",
    actionType: "undraft_pr",
    conditions: { isDraft: true },
    promptTemplate: "",
  },
];

function pullRequest(
  number: number,
  repo: string,
  overrides: Partial<PullRequest> = {},
): PullRequest {
  const comment = {
    id: number * 10,
    body: "The error state is much clearer now. Please add a retry action and check the keyboard navigation before we merge.",
    user: reviewer,
    created_at: "2026-09-06T17:00:00Z",
    updated_at: "2026-09-06T17:00:00Z",
    html_url: "https://github.com/example",
    is_review_comment: false,
    review_state: "CHANGES_REQUESTED",
  };
  return {
    id: number,
    number,
    title: "Improve repository synchronization and retry feedback",
    body: "## What changed\n\n- Added a clear connection state\n- Kept retry actions close to errors\n\n```ts\nawait syncRepository();\n```",
    state: "open",
    is_draft: false,
    html_url: "https://github.com/example",
    created_at: "2026-09-05T16:00:00Z",
    updated_at: "2026-09-06T17:00:00Z",
    head: { ref: "feature/repository-sync", sha: "abc123" },
    base: { ref: "main" },
    user,
    repo_owner: "studio",
    repo_name: repo,
    repo_full_name: `studio/${repo}`,
    comments_count: 1,
    review_comments_count: 1,
    comments: [comment],
    last_comment: comment,
    commits: [],
    checks_status: "success",
    has_merge_conflicts: false,
    mergeable_state: "clean",
    local_path: `/tmp/example/${repo}`,
    ...overrides,
  };
}

const prs = [
  pullRequest(42, "workspace"),
  pullRequest(41, "workspace", {
    title: "Resolve conflicting navigation changes",
    has_merge_conflicts: true,
    checks_status: "failure",
  }),
  pullRequest(28, "design-system", {
    title: "Refine keyboard focus and modal layouts",
    checks_status: "pending",
  }),
  pullRequest(27, "design-system", {
    title: "Draft: reusable interface controls",
    is_draft: true,
    local_path: "",
    comments: [],
    last_comment: undefined,
  }),
];
const mergeHistory = [
  {
    id: 420,
    number: 42,
    title: "Improve repository synchronization and retry feedback",
    repo_full_name: "studio/workspace",
    html_url: "https://github.com/studio/workspace/pull/42",
    base_branch: "main",
    merged_at: "2026-09-08T12:42:00Z",
  },
  {
    id: 280,
    number: 28,
    title: "Refine keyboard focus and modal layouts",
    repo_full_name: "studio/design-system",
    html_url: "https://github.com/studio/design-system/pull/28",
    base_branch: "main",
    merged_at: "2026-09-07T09:18:00Z",
  },
];
const config = {
  githubToken: "",
  hasToken: true,
  maskedToken: "demo...demo",
  defaultAgent: "codex",
  monitoredRepos: ["studio/workspace", "studio/design-system"],
  repoPaths: {
    "studio/workspace": "/tmp/example/workspace",
    "studio/design-system": "",
  },
  directAgentSpawn: false,
};

async function mockWorkspace(
  page: Page,
  options: { missingPath?: boolean; directLaunch?: boolean } = {},
) {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  // Intercept every API operation: these tests never reach GitHub or local worktree endpoints.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      writes.push({ path, body: request.postDataJSON() });
      await route.fulfill({ json: { success: true } });
    } else if (path === "/api/config")
      await route.fulfill({
        json: {
          config: { ...config, directAgentSpawn: !!options.directLaunch },
        },
      });
    else if (path === "/api/rules") await route.fulfill({ json: { rules } });
    else if (path === "/api/prs/history")
      await route.fulfill({ json: { mergeHistory } });
    else if (path === "/api/prs")
      await route.fulfill({
        json: {
          currentUser: "alex",
          monitoredRepos: config.monitoredRepos,
          prsWithGates: prs.map((pr) => ({
            pr:
              options.missingPath && pr.number === 42
                ? { ...pr, local_path: "" }
                : pr,
            evaluatedGates: rules.map((rule) => ({
              rule,
              passed: pr.is_draft
                ? rule.id === "undraft"
                : rule.id !== "undraft",
              generatedPrompt: `Review PR #${pr.number}: ${pr.title}`,
              targetAgent: "codex",
            })),
          })),
        },
      });
    else
      await route.fulfill({
        status: 404,
        json: { error: "Unmocked endpoint" },
      });
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "workflow_active_agent_prs",
      JSON.stringify({
        "pr-card-studio/design-system-28": {
          agent: "claude",
          timestamp: Date.now(),
        },
      }),
    ),
  );
  await page.goto("/");
  await expect(page.locator(".pr-detail").first()).toBeVisible();
  return writes;
}

test("merge history drawer shows only PR merge events with timestamps", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.getByRole("button", { name: "Merge history" }).click();

  const panel = page.locator("#merge-history-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Pull requests landed in main");
  await expect(page.locator(".merge-history-entry")).toHaveCount(2);
  await expect(page.locator(".merge-history-entry").first()).toContainText("#42");
  await expect(page.locator(".merge-history-entry time").first()).toHaveAttribute(
    "dateTime",
    "2026-09-08T12:42:00Z",
  );
  await expect(panel.locator("a").first()).toHaveAttribute(
    "href",
    "https://github.com/studio/workspace/pull/42",
  );

  await page.keyboard.press("Escape");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
});

async function assertDialogFits(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const fits = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.left >= 0 &&
      rect.right <= innerWidth + 1 &&
      rect.top >= 0 &&
      rect.bottom <= innerHeight + 1 &&
      element.scrollWidth <= element.clientWidth + 1
    );
  });
  expect(fits).toBe(true);
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
}

test("workspace highlights attention, active agents, conflicts, and review actions", async ({
  page,
}, info) => {
  await mockWorkspace(page);
  await expect(
    page
      .locator(".summary-queues")
      .getByRole("button", { name: /Needs your attention/ }),
  ).toBeVisible();
  await expect(page.locator(".agent-summary")).toContainText(
    "1 active session",
  );
  await expect(page.locator(".sidebar-pr-status--rose")).toContainText(
    "Conflicts",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "desktop") {
    const sidebar = await page.locator(".review-sidebar").boundingBox();
    const repository = await page.locator(".repository-heading").first().boundingBox();
    expect(sidebar!.y).toBeLessThanOrEqual(60);
    expect(repository!.y).toBeLessThanOrEqual(110);
  }
  await page.screenshot({
    path: info.outputPath("workspace.png"),
    fullPage: false,
  });
  const card = page.locator(".pr-detail").first();
  await card.getByRole("link", { name: "View actions" }).click();
  await expect(
    card.getByRole("button", { name: "Address issues", exact: false }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("review-actions.png") });
  await page
    .getByRole("textbox", { name: "Search pull requests" })
    .fill("no-matching-pull-request");
  await expect(
    page.getByText("No matching pull requests", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear search", exact: true })
    .first()
    .click();
  await expect(page.locator(".pr-detail").first()).toBeVisible();
});

test("settings supports selection, cancellation, and visible save failures", async ({
  page,
}, info) => {
  const writes = await mockWorkspace(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await assertDialogFits(page);
  await page.screenshot({ path: info.outputPath("settings.png") });
  await page
    .getByRole("textbox", { name: "Monitored repositories" })
    .fill("studio/changed");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Monitored repositories" }),
  ).toHaveValue(config.monitoredRepos.join(", "));
  await page.route("**/api/config", async (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "Disk is read-only" } })
      : route.fallback(),
  );
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Disk is read-only",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("rules has editable conditions, undo, save failures, and an empty state", async ({
  page,
}, info) => {
  await mockWorkspace(page);
  await page.getByRole("button", { name: "Logic gates", exact: true }).click();
  await assertDialogFits(page);
  await page.screenshot({ path: info.outputPath("rules.png") });
  await page
    .getByRole("checkbox", { name: "Status checks are failing" })
    .check();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Status checks are failing" }),
  ).toBeChecked();
  await page.route("**/api/rules", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "Could not write rules" } })
      : route.fallback(),
  );
  await page.getByRole("button", { name: "Save rules" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Could not write rules",
  );
  for (let i = 0; i < rules.length; i++)
    await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("No rules yet", { exact: true })).toBeVisible();
});

test("agent prompt distinguishes copying, tracking, and launching", async ({
  page,
}, info) => {
  const writes = await mockWorkspace(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .locator(".pr-detail")
    .first()
    .getByRole("button", { name: /Address issues/ })
    .click();
  await assertDialogFits(page);
  await page.getByRole("radio", { name: /Claude Code/ }).check();
  await page.screenshot({ path: info.outputPath("agent-prompt.png") });
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".agent-summary")).toContainText(
    "1 active session",
  );
  await page
    .getByRole("button", { name: "Launch Claude Code", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    writes.find((write) => write.path === "/api/agent/spawn")?.body.agent,
  ).toBe("claude");
});

test("comment and draft actions have explicit confirmation controls", async ({
  page,
}, info) => {
  const writes = await mockWorkspace(page);
  await page
    .locator(".pr-detail")
    .first()
    .getByRole("button", { name: /Reply on GitHub/ })
    .click();
  await assertDialogFits(page);
  await page.screenshot({ path: info.outputPath("comment.png") });
  await page
    .getByRole("textbox", { name: "Comment to publish" })
    .fill("Thanks, this is ready for another review.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  expect(
    writes.find((write) => write.path === "/api/prs/comment")?.body.commentBody,
  ).toBe("Thanks, this is ready for another review.");
  await page
    .locator(".pr-detail")
    .filter({ hasText: "Draft: reusable interface controls" })
    .getByRole("button", { name: "Ready for review", exact: true })
    .click();
  await assertDialogFits(page);
  await page.screenshot({ path: info.outputPath("draft.png") });
  await page
    .getByRole("button", { name: "Mark ready for review", exact: true })
    .click();
  expect(writes.some((write) => write.path === "/api/prs/undraft")).toBe(true);
});

test("merge clearly shows its target and blocks dismissal while submitting", async ({
  page,
}, info) => {
  await mockWorkspace(page);
  await page
    .locator(".pr-detail")
    .first()
    .getByRole("button", { name: "Merge", exact: true })
    .click();
  await assertDialogFits(page);
  await expect(page.locator(".merge-target")).toContainText("main");
  await page.screenshot({ path: info.outputPath("merge.png") });
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/prs/merge", async (route) => {
    await pending;
    await route.fulfill({
      status: 500,
      json: { error: "Base branch changed. Refresh and try again." },
    });
  });
  await page.getByRole("button", { name: "Confirm merge" }).click();
  await expect(page.getByRole("button", { name: "Merging…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  release();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Base branch changed",
  );
});

test("worktree removal and tracking reset have different consequences", async ({
  page,
}, info) => {
  const writes = await mockWorkspace(page);
  await page
    .getByRole("button", { name: "Remove all worktrees", exact: true })
    .click();
  await assertDialogFits(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Uncommitted work can be lost",
  );
  await page.screenshot({ path: info.outputPath("remove-worktrees.png") });
  await page.getByRole("button", { name: "Keep worktrees" }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Clear all agent sessions" }).click();
  await assertDialogFits(page);
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "does not stop agents",
  );
  await page.screenshot({ path: info.outputPath("clear-sessions.png") });
  await page
    .getByRole("button", { name: "Clear 1 session", exact: true })
    .click();
  await expect(page.locator(".agent-summary")).toContainText(
    "No active agents",
  );
});

test("missing paths explain blocked launches and still allow manual tracking", async ({
  page,
}, info) => {
  const writes = await mockWorkspace(page, { missingPath: true });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .locator(".pr-detail")
    .first()
    .getByRole("button", { name: /Address issues/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Add a local repository path to launch",
  );
  await expect(
    page.getByRole("button", { name: "Launch Codex", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: info.outputPath("missing-path.png") });
  await page
    .getByRole("button", { name: "Copy & track agent", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".agent-summary")).toContainText(
    "2 active sessions",
  );
  expect(writes).toHaveLength(0);
});

test("connection failures show recovery actions instead of a clear queue", async ({
  page,
}, info) => {
  await mockWorkspace(page);
  await page.route("**/api/prs?*", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "GitHub access token has expired." },
    }),
  );
  await page
    .locator(".workspace-toolbar")
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Unable to load pull requests" }),
  ).toBeVisible();
  await expect(
    page.locator(".workspace-feedback").getByRole("alert"),
  ).toContainText("GitHub access token has expired.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("connection-error.png") });
  await page.getByRole("button", { name: "Open connection settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workspace settings" }),
  ).toBeVisible();
});

test("attention queues support keyboard navigation and direct launch is visible", async ({
  page,
}) => {
  const writes = await mockWorkspace(page, { directLaunch: true });
  await expect(
    page.getByRole("button", { name: "Direct launch is on" }),
  ).toBeVisible();
  const queueButton = page
    .locator(".summary-queues")
    .getByRole("button", { name: /Needs your attention/ });
  await queueButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".queue-popover")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".queue-popover")).toHaveCount(0);
  await page
    .locator(".pr-detail")
    .first()
    .getByRole("button", { name: /Address issues/ })
    .click();
  await expect
    .poll(() => writes.some((write) => write.path === "/api/agent/spawn"))
    .toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".workspace-feedback").getByRole("status"),
  ).toContainText("Launched");
});
