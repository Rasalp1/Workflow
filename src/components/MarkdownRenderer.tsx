'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`markdown-content text-xs text-slate-200 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node, href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all font-medium"
              {...props}
            >
              {children}
            </a>
          ),
          code: ({ node, className, children, ...props }: any) => {
            const contentStr = String(children || '').replace(/\n$/, '');
            const isMultiLine = contentStr.includes('\n');
            const isLanguageBlock = Boolean(className && className.includes('language-'));

            if (!isMultiLine && !isLanguageBlock) {
              return (
                <code
                  className="bg-slate-900/90 text-purple-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-slate-800/80 inline font-semibold"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <pre className="bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 overflow-x-auto text-[11px] font-mono text-slate-200 my-2 shadow-inner">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="inline font-bold text-slate-100">{children}</strong>,
          em: ({ children }) => <em className="inline italic text-slate-200">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-0.5 my-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-0.5 my-1.5">{children}</ol>,
          li: ({ children }) => (
            <li className="text-slate-300 my-0.5 [&>p]:inline [&>p]:m-0 leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500/70 pl-3 py-1 my-2 italic text-slate-400 bg-slate-900/50 rounded-r-lg">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h1 className="text-sm font-bold text-slate-100 my-2 border-b border-slate-800 pb-0.5">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xs font-bold text-slate-100 my-1.5 border-b border-slate-800 pb-0.5">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="text-xs font-bold text-slate-200 my-1">{children}</h3>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-slate-800">
              <table className="w-full text-xs text-left border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-slate-900 p-2 font-semibold text-slate-300 border-b border-slate-800">{children}</th>
          ),
          td: ({ children }) => (
            <td className="p-2 border-b border-slate-800/60 text-slate-300">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
