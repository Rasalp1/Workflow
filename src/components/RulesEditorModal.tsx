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
  const [editableRules, setEditableRules] = useState<LogicalGateRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setEditableRules(JSON.parse(JSON.stringify(rules)));
    if (rules.length > 0) {
      setSelectedRuleId(rules[0].id);
    }
  }, [rules]);

  if (!isOpen) return null;

  const currentRule = editableRules.find((r) => r.id === selectedRuleId) || editableRules[0];

  const handleToggleRule = (id: string) => {
    setEditableRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleUpdateCurrentRule = (field: keyof LogicalGateRule, value: any) => {
    if (!currentRule) return;
    setEditableRules((prev) =>
      prev.map((r) => (r.id === currentRule.id ? { ...r, [field]: value } : r))
    );
  };

  const handleUpdateConditions = (field: string, value: any) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel rounded-2xl w-full max-w-4xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Logical Gates & Prompt Rules</h3>
              <p className="text-xs text-slate-400">
                Define gate conditions for when action buttons appear on PR cards
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Right Form */}
        <div className="flex-1 flex overflow-hidden">
          {/* Rules List Sidebar */}
          <div className="w-1/3 border-r border-slate-800 p-4 space-y-3 bg-slate-950/40 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Configured Rules ({editableRules.length})
              </span>
              <button
                onClick={handleAddRule}
                className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {editableRules.map((rule) => (
              <div
                key={rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedRuleId === rule.id
                    ? 'bg-slate-800/90 border-indigo-500/80 shadow-md'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{rule.buttonLabel}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRule(rule.id);
                    }}
                    className="text-slate-400 hover:text-indigo-400"
                  >
                    {rule.enabled ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{rule.name}</p>
              </div>
            ))}
          </div>

          {/* Rule Details & Condition Editor */}
          {currentRule && (
            <div className="flex-1 p-6 space-y-5 overflow-y-auto bg-slate-900/40">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{currentRule.name}</h4>
                  <p className="text-xs text-slate-400">Rule ID: {currentRule.id}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteRule(currentRule.id)}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Delete Rule
                </button>
              </div>

              {/* General Properties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Button Label:</label>
                  <input
                    type="text"
                    value={currentRule.buttonLabel}
                    onChange={(e) => handleUpdateCurrentRule('buttonLabel', e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Button Color Theme:</label>
                  <select
                    value={currentRule.buttonColor || 'indigo'}
                    onChange={(e) => handleUpdateCurrentRule('buttonColor', e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
                <label className="text-xs font-semibold text-slate-300">Gate Execution Conditions:</label>
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.lastCommentNotCurrentUser}
                      onChange={(e) =>
                        handleUpdateConditions('lastCommentNotCurrentUser', e.target.checked)
                      }
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>Last comment was left by someone other than the current user</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.hasUnresolvedComments}
                      onChange={(e) => handleUpdateConditions('hasUnresolvedComments', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>PR contains review or discussion comments</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={!!currentRule.conditions.checksFailing}
                      onChange={(e) => handleUpdateConditions('checksFailing', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>CI/CD status checks are failing</span>
                  </label>
                </div>
              </div>

              {/* Prompt Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-purple-400" /> Prompt Template:
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Vars: {'{pr_number}'}, {'{pr_title}'}, {'{repo_name}'}, {'{branch}'}, {'{last_comment_body}'}
                  </span>
                </div>

                <textarea
                  rows={7}
                  value={currentRule.promptTemplate}
                  onChange={(e) => handleUpdateCurrentRule('promptTemplate', e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Rules...' : 'Save Rule Engine Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
