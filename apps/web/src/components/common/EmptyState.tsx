import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface EmptyStateProps {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
}) => {
  const { playHapticClick } = useTheme();

  return (
    <div className="bg-white dark:bg-ink-800/80 rounded-3xl p-12 text-center max-w-lg mx-auto border border-dashed border-slate-300 dark:border-slate-700 shadow-subtle my-8">
      <div className="w-14 h-14 rounded-2xl bg-scratchly-50 dark:bg-scratchly-950/60 border border-scratchly-200/80 dark:border-scratchly-800 text-scratchly-600 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-extrabold text-ink-900 dark:text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-medium">{description}</p>
      {actionText && onAction && (
        <button
          onClick={() => {
            playHapticClick();
            onAction();
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white font-bold text-xs transition-all shadow-sm hover:shadow-glow-blue active:scale-95"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
