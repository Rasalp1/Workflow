'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderX, X, AlertTriangle, RefreshCw } from 'lucide-react';

interface CloseWorktreesConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isClosing: boolean;
  error?: string | null;
}

export const CloseWorktreesConfirmModal: React.FC<CloseWorktreesConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isClosing,
  error,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isClosing) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClosing, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !isClosing) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md border border-gray-200 shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
              <FolderX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Close All Worktrees
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                Antigravity IDE Direct CLI Execution
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isClosing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3 bg-white">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            Are you sure you want to close all git worktrees across all monitored repos?
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">
            This will open a terminal tab in Antigravity IDE (preferring <strong className="text-gray-800 font-mono">MedSAMapp</strong>) and directly execute shell commands to remove and prune all worktrees existing in both repositories.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isClosing}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isClosing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isClosing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Opening Terminal...</span>
              </>
            ) : (
              <>
                <FolderX className="w-3.5 h-3.5" />
                <span>Close All Worktrees</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

