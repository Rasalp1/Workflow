'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ClearAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  activeCount: number;
}

export const ClearAgentsModal: React.FC<ClearAgentsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  activeCount,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-md border border-gray-200 shadow-2xl overflow-hidden flex flex-col transition-all">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Clear Agent Sessions
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                {activeCount} active agent session{activeCount !== 1 ? 's' : ''}
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

        {/* Modal Body */}
        <div className="p-5 space-y-3 bg-white">
          <p className="text-sm text-gray-800 leading-relaxed font-semibold">
            Do you want to clear all agent sessions?
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            This will clear the working status indicators for all active agents currently recorded in the app.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-2xs cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
          >
            Clear All Sessions
          </button>
        </div>
      </div>
    </div>
  );
};
