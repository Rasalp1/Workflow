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
    <div className={`markdown-content text-xs text-gray-700 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children, ...props }) => {
            const isSafeScheme =
              !href ||
              href.startsWith('http://') ||
              href.startsWith('https://') ||
              href.startsWith('mailto:') ||
              href.startsWith('#');
            const safeHref = isSafeScheme ? href : '#';

            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline text-blue-600 hover:text-blue-800 underline underline-offset-2 break-all font-medium"
                {...props}
              >
                {children}
              </a>
            );
          },
          code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) => {
            const contentStr = String(children || '').replace(/\n$/, '');
            const isMultiLine = contentStr.includes('\n');
            const isLanguageBlock = Boolean(className && className.includes('language-'));

            if (!isMultiLine && !isLanguageBlock) {
              return (
                <code
                  className="bg-gray-100 text-purple-700 px-1.5 py-0.5 rounded font-mono text-[11px] border border-gray-200 inline font-semibold"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <pre className="bg-gray-50 p-3 rounded-lg border border-gray-200 overflow-x-auto text-[11px] font-mono text-gray-800 my-2">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="inline font-bold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="inline italic text-gray-600">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-0.5 my-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-0.5 my-1.5">{children}</ol>,
          li: ({ children }) => (
            <li className="text-gray-700 my-0.5 [&>p]:inline [&>p]:m-0 leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-300 pl-3 py-1 my-2 italic text-gray-500 bg-blue-50/50 rounded-r-lg">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h1 className="text-sm font-bold text-gray-900 my-2 border-b border-gray-200 pb-0.5">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xs font-bold text-gray-900 my-1.5 border-b border-gray-200 pb-0.5">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="text-xs font-bold text-gray-800 my-1">{children}</h3>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-gray-200">
              <table className="w-full text-xs text-left border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-gray-50 p-2 font-semibold text-gray-700 border-b border-gray-200">{children}</th>
          ),
          td: ({ children }) => (
            <td className="p-2 border-b border-gray-100 text-gray-600">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
