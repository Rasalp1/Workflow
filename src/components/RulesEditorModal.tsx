'use client';

import React, { useState } from 'react';
import { LogicalGateRule } from '@/types';
import { X, Save, Plus, Trash2, Sliders, CheckSquare, Square, Code } from 'lucide-react';

interface RulesEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: LogicalGateRule[];
  onSaveRules: (updatedRules: LogicalGateRule[]) => Promise<void>;
}

export const RulesEditorModal: React.FC<RulesEditorModalProps> = ({
  isOpen,
  onClose,
  rules,
  onSaveRules,
}) => {
  const [prevRules, setPrevRules] = useState<LogicalGateRule[] | null>(null);
  const [editableRules, setEditableRules] = useState<LogicalGateRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (rules && rules !== prevRules) {
    setPrevRules(rules);
    const cloned = JSON.parse(JSON.stringify(rules));
    setEditableRules(cloned);
    if (cloned.length > 0 && !selectedRuleId) {
      setSelectedRuleId(cloned[0].id);
    }
  }

  if (!isOpen) return null;

  const currentRule = editableRules.find((r) => r.id === selectedRuleId) || editableRules[0];

  const handleToggleRule = (id: string) => {
    setEditableRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleUpdateCurrentRule = (field: keyof LogicalGateRule, value: unknown) => {
    if (!currentRule) return;
    setEditableRules((prev) =>
      prev.map((r) => (r.id === currentRule.id ? { ...r, [field]: value } : r))
    );
  };

  const handleUpdateConditions = (field: string, value: unknown) => {
    if (!currentRule) return;
    setEditableRules((prev) =>
      prev.map((r) =>
        r.id === currentRule.id
          ? {
              ...r,
              conditions: {
                ...r.conditions,
                [field]: value,
              },
            }
          : r
      )
    );
  };

  const handleAddRule = () => {
    const newId = `custom-rule-${Date.now()}`;
    const newRule: LogicalGateRule = {
      id: newId,
      name: 'New Gate Rule',
      description: 'Custom logical gate rule',
      enabled: true,
      buttonLabel: 'Run Agent Action',
      buttonIcon: 'Terminal',
      buttonColor: 'indigo',
      conditions: {
        lastCommentNotCurrentUser: true,
      },
      promptTemplate: 'Perform task for PR #{pr_number} ({pr_title}) in repository {repo_name}.',
    };
    setEditableRules((prev) => [...prev, newRule]);
    setSelectedRuleId(newId);
  };

  const handleDeleteRule = (id: string) => {
    setEditableRules((prev) => prev.filter((r) => r.id !== id));
    if (selectedRuleId === id) {
      const remaining = editableRules.filter((r) => r.id !== id);
      setSelectedRuleId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRules(editableRules);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="panel-raised rounded-xl w-full max-w-4xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-600">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Logical Gates & Prompt Rules</h3>
              <p className="text-xs text-gray-500">
                Define gate conditions for when action buttons appear on PR cards
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Right Form */}
        <div className="flex-1 flex overflow-hidden">
          {/* Rules List Sidebar */}
          <div className="w-1/3 border-r border-gray-100 p-4 space-y-2 bg-gray-50/60 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Rules ({editableRules.length})
              </span>
              <button
                onClick={handleAddRule}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {editableRules.map((rule) => (
              <div
                key={rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  selectedRuleId === rule.id
                    ? 'bg-white border-blue-200 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800">{rule.buttonLabel}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRule(rule.id);
                    }}
                    className="text-gray-400 hover:text-blue-600"
                  >
                    {rule.enabled ? (
                      <CheckSquare className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{rule.name}</p>
              </div>
            ))}
          </div>

          {/* Rule Details & Condition Editor */}
          {currentRule && (
            <div className="flex-1 p-5 space-y-5 overflow-y-auto bg-white">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{currentRule.name}</h4>
                  <p className="text-xs text-gray-400 font-mono">ID: {currentRule.id}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteRule(currentRule.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Rule
                </button>
              </div>

              {/* General Properties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Button Label:</label>
                  <input
                    type="text"
                    value={currentRule.buttonLabel}
                    onChange={(e) => handleUpdateCurrentRule('buttonLabel', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Button Color Theme:</label>
                  <select
                    value={currentRule.buttonColor || 'indigo'}
                    onChange={(e) => handleUpdateCurrentRule('buttonColor', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-blue-400 transition-colors"
                  >
                    <option value="indigo">Indigo / Blue</option>
                    <option value="purple">Purple / Violet</option>
                    <option value="rose">Rose / Red</option>
                    <option value="amber">Amber / Yellow</option>
                    <option value="emerald">Emerald / Green</option>
                  </select>
                </div>
              </div>

              {/* Conditions Checklist */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Gate Execution Conditions:</label>
                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.prOwnedByCurrentUser}
                      onChange={(e) =>
                        handleUpdateConditions('prOwnedByCurrentUser', e.target.checked)
                      }
                      className="rounded border-gray-300 bg-white text-blue-600 focus:ring-0"
                    />
                    <span>PR is owned by current user (Rasalp1)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.prOwnedByNonCurrentUser}
                      onChange={(e) =>
                        handleUpdateConditions('prOwnedByNonCurrentUser', e.target.checked)
                      }
                      className="rounded border-gray-300 bg-white text-blue-600 focus:ring-0"
                    />
                    <span>PR is owned by someone other than current user</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.hasNoComments}
                      onChange={(e) =>
                        handleUpdateConditions('hasNoComments', e.target.checked)
                      }
                      className="rounded border-gray-300 bg-white text-blue-600 focus:ring-0"
                    />
                    <span>PR does not have any comments yet</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.hasCommentsByCurrentUser}
                      onChange={(e) =>
                        handleUpdateConditions('hasCommentsByCurrentUser', e.target.checked)
                      }
                      className="rounded border-gray-300 bg-white text-blue-600 focus:ring-0"
                    />
                    <span>PR has prior context/comment by current user (Rasalp1)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.lastCommentNotCurrentUser}
                      onChange={(e) =>
                        handleUpdateConditions('lastCommentNotCurrentUser', e.target.checked)
                      }
                      className="rounded border-gray-300 bg-white text-blue-600 focus:ring-0"
                    />
                    <span>Last comment was left by someone other than the current user</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.hasUnresolvedComments}
                      onChange={(e) => handleUpdateConditions('hasUnresolvedComments', e.target.checked)}
                      className="rounded border-gray-300 bg-white text-blue-600 focus:ring-0"
                    />
                    <span>PR contains review or discussion comments</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.checksFailing}
                      onChange={(e) => handleUpdateConditions('checksFailing', e.target.checked)}
                      className="rounded border-gray-300 bg-white text-blue-600 focus:ring-0"
                    />
                    <span>CI/CD status checks are failing</span>
                  </label>
                </div>
              </div>

              {/* Prompt Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-purple-500" /> Prompt Template:
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Vars: {'{pr_number}'}, {'{pr_title}'}, {'{repo_name}'}, {'{branch}'}, {'{last_comment_body}'}
                  </span>
                </div>

                <textarea
                  rows={7}
                  value={currentRule.promptTemplate}
                  onChange={(e) => handleUpdateCurrentRule('promptTemplate', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Rules...' : 'Save Rule Engine Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
