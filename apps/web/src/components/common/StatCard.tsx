import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.FC<{ className?: string }>;
  accentColor?: 'scratchly' | 'emerald' | 'amber' | 'rose' | 'purple' | 'indigo';
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = 'scratchly',
  badge,
}) => {
  const colorMap = {
    scratchly: {
      border: 'hover:border-scratchly-300 dark:hover:border-scratchly-700',
      iconBg: 'bg-scratchly-50 text-scratchly-600 dark:bg-scratchly-950/60 dark:text-scratchly-300 border-scratchly-200/80 dark:border-scratchly-800',
      badge: 'bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300',
    },
    indigo: {
      border: 'hover:border-scratchly-300 dark:hover:border-scratchly-700',
      iconBg: 'bg-scratchly-50 text-scratchly-600 dark:bg-scratchly-950/60 dark:text-scratchly-300 border-scratchly-200/80 dark:border-scratchly-800',
      badge: 'bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300',
    },
    emerald: {
      border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
      badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
    },
    amber: {
      border: 'hover:border-amber-300 dark:hover:border-amber-700',
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
      badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
    },
    rose: {
      border: 'hover:border-rose-300 dark:hover:border-rose-700',
      iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
      badge: 'bg-rose-50 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
    },
    purple: {
      border: 'hover:border-purple-300 dark:hover:border-purple-700',
      iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/80 dark:border-purple-800',
      badge: 'bg-purple-50 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
    },
  };

  const scheme = colorMap[accentColor] || colorMap.scratchly;

  return (
    <div
      className={`bg-white dark:bg-ink-800/90 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-subtle hover:shadow-card transition-all duration-200 hover:-translate-y-0.5 ${scheme.border} relative overflow-hidden`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-ink-900 dark:text-white mt-1.5 tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl border ${scheme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {badge && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Status</span>
          <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${scheme.badge}`}>{badge}</span>
        </div>
      )}
    </div>
  );
};
