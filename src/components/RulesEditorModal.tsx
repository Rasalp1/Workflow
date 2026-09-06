"use client";

import { useState } from "react";
import { Plus, Save, SlidersHorizontal, Trash2, Undo2 } from "lucide-react";
import type { LogicalGateRule } from "@/types";
import { GateIcon } from "./ui/GateIcon";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

interface RulesEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: LogicalGateRule[];
  onSaveRules: (rules: LogicalGateRule[]) => Promise<void>;
  currentUser?: string | null;
}

const conditionLabels = [
  ["prOwnedByCurrentUser", "Owned by you"],
  ["prOwnedByNonCurrentUser", "Owned by someone else"],
  ["hasNoComments", "No comments yet"],
  ["hasCommentsByCurrentUser", "You have already commented"],
  ["lastCommentNotCurrentUser", "Latest comment is from someone else"],
  ["hasUnresolvedComments", "Contains review or discussion comments"],
  ["hasMergeConflicts", "Has merge conflicts"],
  ["checksFailing", "Status checks are failing"],
  ["notReviewedByOthers", "Not already handled by other reviewers"],
  ["isDraft", "Pull request is a draft"],
] as const;

export function RulesEditorModal({ isOpen, ...props }: RulesEditorModalProps) {
  if (!isOpen) return null;
  return <RulesForm {...props} />;
}

function RulesForm({
  onClose,
  rules,
  onSaveRules,
  currentUser,
}: Omit<RulesEditorModalProps, "isOpen">) {
  const [editable, setEditable] = useState(() => structuredClone(rules));
  const [selectedId, setSelectedId] = useState(rules[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{
    rule: LogicalGateRule;
    index: number;
  } | null>(null);
  const current =
    editable.find((rule) => rule.id === selectedId) || editable[0];
  const update = (patch: Partial<LogicalGateRule>) =>
    setEditable((prev) =>
      prev.map((rule) =>
        rule.id === current?.id ? { ...rule, ...patch } : rule,
      ),
    );

  function add() {
    const rule: LogicalGateRule = {
      id: `custom-rule-${crypto.randomUUID()}`,
      name: "New rule",
      description: "",
      enabled: true,
      buttonLabel: "Run agent",
      buttonIcon: "Terminal",
      buttonColor: "indigo",
      actionType: "spawn_agent",
      conditions: { lastCommentNotCurrentUser: true },
      promptTemplate: "Review PR #{pr_number} ({pr_title}) in {repo_name}.",
    };
    setEditable([...editable, rule]);
    setSelectedId(rule.id);
  }

  async function save() {
    if (
      editable.some((rule) => !rule.name.trim() || !rule.buttonLabel.trim())
    ) {
      setError("Every rule needs a name and a button label.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSaveRules(editable);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save your rules. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Logic gates"
      description="Choose when an action appears and what it asks an agent to do."
      icon={<SlidersHorizontal />}
      size="wide"
      busy={busy}
      bodyClassName="rules-dialog-body"
      footer={
        <>
          <span className="footer-hint">
            {editable.filter((rule) => rule.enabled).length} of{" "}
            {editable.length} rules enabled · Save to apply
          </span>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {!busy && <Save size={16} />}
            {busy ? "Saving rules…" : "Save rules"}
          </Button>
        </>
      }
    >
      {error && (
        <div className="rules-feedback">
          <Notice tone="danger" title="Rules weren’t saved">
            {error}
          </Notice>
        </div>
      )}
      {removed && (
        <div className="rules-undo">
          <span>Removed “{removed.rule.name}”</span>
          <Button
            variant="quiet"
            size="small"
            disabled={busy}
            onClick={() => {
              const next = [...editable];
              next.splice(removed.index, 0, removed.rule);
              setEditable(next);
              setSelectedId(removed.rule.id);
              setRemoved(null);
            }}
          >
            <Undo2 size={14} />
            Undo
          </Button>
        </div>
      )}
      <div className="rules-layout">
        <nav className="rules-navigation" aria-label="Rules">
          <div className="field-heading">
            <span className="field-label">
              Your rules <span className="count-chip">{editable.length}</span>
            </span>
            <Button size="small" onClick={add} disabled={busy}>
              <Plus size={14} />
              Add
            </Button>
          </div>
          {editable.map((rule) => (
            <button
              type="button"
              className="rule-navigation-item"
              key={rule.id}
              aria-current={current?.id === rule.id ? "true" : undefined}
              onClick={() => setSelectedId(rule.id)}
              disabled={busy}
            >
              <span className="rule-navigation-title">{rule.name}</span>
              <span
                className={`status-badge ${rule.enabled ? "status-badge--success" : "status-badge--neutral"}`}
              >
                {rule.enabled ? "Enabled" : "Disabled"}
              </span>
              <small>{rule.buttonLabel}</small>
            </button>
          ))}
        </nav>
        {current ? (
          <fieldset className="rules-editor" disabled={busy}>
            <div className="rule-editor-heading">
              <div>
                <p className="eyebrow">ACTION RULE</p>
                <h3>{current.name}</h3>
              </div>
              <Button
                variant="danger-quiet"
                size="small"
                onClick={() => {
                  setRemoved({
                    rule: current,
                    index: editable.indexOf(current),
                  });
                  setEditable(
                    editable.filter((rule) => rule.id !== current.id),
                  );
                }}
              >
                <Trash2 size={15} />
                Remove
              </Button>
            </div>
            <label className="launch-setting" data-enabled={current.enabled}>
              <span>
                <strong>Enable this rule</strong>
                <small>
                  {current.enabled
                    ? "This action appears when all selected conditions match."
                    : "This rule is saved but its action will not appear."}
                </small>
              </span>
              <input
                className="ui-switch"
                type="checkbox"
                role="switch"
                checked={current.enabled}
                onChange={(event) => update({ enabled: event.target.checked })}
              />
            </label>
            <div className="form-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="rule-name">
                  Rule name
                </label>
                <input
                  id="rule-name"
                  className="ui-input"
                  value={current.name}
                  onChange={(event) => update({ name: event.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="rule-label">
                  Button label
                </label>
                <input
                  id="rule-label"
                  className="ui-input"
                  value={current.buttonLabel}
                  onChange={(event) =>
                    update({ buttonLabel: event.target.value })
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="rule-action">
                  Action
                </label>
                <select
                  id="rule-action"
                  className="ui-input"
                  value={current.actionType || "spawn_agent"}
                  onChange={(event) =>
                    update({
                      actionType: event.target
                        .value as LogicalGateRule["actionType"],
                    })
                  }
                >
                  <option value="spawn_agent">Launch agent</option>
                  <option value="post_comment">Post GitHub comment</option>
                  <option value="undraft_pr">Mark ready for review</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="rule-color">
                  Action color
                </label>
                <select
                  id="rule-color"
                  className="ui-input"
                  value={current.buttonColor || "indigo"}
                  onChange={(event) =>
                    update({
                      buttonColor: event.target
                        .value as LogicalGateRule["buttonColor"],
                    })
                  }
                >
                  <option value="blue">Blue</option>
                  <option value="indigo">Indigo</option>
                  <option value="purple">Purple</option>
                  <option value="emerald">Green</option>
                  <option value="amber">Amber</option>
                  <option value="rose">Red</option>
                </select>
              </div>
            </div>
            <div className="rule-preview">
              <span className="field-help">Button preview</span>
              <span
                className="gate-button"
                data-tone={current.buttonColor || "indigo"}
              >
                <GateIcon name={current.buttonIcon} />
                {current.buttonLabel || "Button label"}
              </span>
            </div>
            <section className="field-group">
              <h4 className="section-heading">Match all conditions</h4>
              <p className="field-help">
                Conditions are combined. “You” refers to{" "}
                {currentUser ? `@${currentUser}` : "the signed-in GitHub user"}.
              </p>
              <div className="condition-list">
                {conditionLabels.map(([key, label]) => (
                  <label key={key} className="condition-row">
                    <input
                      type="checkbox"
                      checked={!!current.conditions[key]}
                      onChange={(event) =>
                        update({
                          conditions: {
                            ...current.conditions,
                            [key]: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>
            <div className="field-group">
              <label className="field-label" htmlFor="rule-template">
                Prompt or comment template
              </label>
              <textarea
                id="rule-template"
                className="ui-input prompt-editor"
                rows={7}
                value={current.promptTemplate}
                onChange={(event) =>
                  update({ promptTemplate: event.target.value })
                }
              />
              <p className="field-help">
                Available variables:{" "}
                <code>
                  {
                    "{pr_number}, {pr_title}, {repo_name}, {branch}, {last_comment_body}"
                  }
                </code>
              </p>
            </div>
          </fieldset>
        ) : (
          <div className="rules-empty">
            <SlidersHorizontal size={32} />
            <h3>No rules yet</h3>
            <p>Add a rule to create an action for your review workflow.</p>
            <Button variant="primary" onClick={add} disabled={busy}>
              <Plus size={16} />
              Create your first rule
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
