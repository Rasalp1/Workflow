'use client';

import React from 'react';
import { PullRequest } from '@/types';
import { GitMerge, X, AlertCircle, RefreshCw, GitBranch } from 'lucide-react';

interface MergeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  pr: PullRequest | null;
  onConfirm: () => Promise<void>;
  isMerging: boolean;
  error?: string | null;
}

export const MergeConfirmModal: React.FC<MergeConfirmModalProps> = ({
  isOpen,
  onClose,
  pr,
  onConfirm,
  isMerging,
  error,
}) => {
  if (!isOpen || !pr) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isMerging) onClose();
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-md border border-gray-200 shadow-2xl overflow-hidden flex flex-col transition-all">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Confirm PR Merge
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                {pr.repo_full_name} • #{pr.number}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isMerging}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 bg-white">
          <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 leading-tight">
              {pr.title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
              <GitBranch className="w-3.5 h-3.5 text-gray-400" />
              <span>{pr.head.ref}</span>
              <span className="text-gray-400">→</span>
              <span className="font-semibold text-emerald-700">{pr.base.ref}</span>
            </div>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            Are you sure you want to merge pull request <strong className="text-gray-900 font-mono">#{pr.number}</strong> into <strong className="text-gray-900 font-mono">{pr.base.ref}</strong>? This action will merge all commits from branch <strong className="text-gray-900 font-mono">{pr.head.ref}</strong>.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isMerging}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isMerging}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isMerging ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Merging...</span>
              </>
            ) : (
              <>
                <GitMerge className="w-3.5 h-3.5" />
                <span>Confirm Merge</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
