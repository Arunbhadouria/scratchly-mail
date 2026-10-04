import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { StatCard } from '../components/common/StatCard';
import { useTheme } from '../context/ThemeContext';
import {
  CheckCircle2,
  Send,
  ShieldCheck,
  UserX,
  RotateCw,
  Sparkles,
} from 'lucide-react';

interface AnalyticsData {
  delivery: {
    totalRecipients: number;
    delivered: number;
    failed: number;
    queued: number;
    sending: number;
    cancelled: number;
    deliveryRate: number;
  };
  contacts: {
    total: number;
    eligible: number;
    suppressed: number;
  };
  campaigns: {
    total: number;
    active: number;
    completed: number;
    draft: number;
  };
}

export const AnalyticsView: React.FC = () => {
  const { playHapticClick } = useTheme();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    const res = await api.get<AnalyticsData>('/analytics/overview');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  const delivery = data?.delivery || {
    totalRecipients: 0,
    delivered: 0,
    failed: 0,
    queued: 0,
    sending: 0,
    cancelled: 0,
    deliveryRate: 100,
  };
  const contacts = data?.contacts || { total: 0, eligible: 0, suppressed: 0 };
  const campaigns = data?.campaigns || { total: 0, active: 0, completed: 0, draft: 0 };

  const totalRecipients = delivery.totalRecipients || 0;
  const delivered = delivery.delivered || 0;
  const failed = delivery.failed || 0;
  const queued = delivery.queued || 0;
  const sending = delivery.sending || 0;
  const cancelled = delivery.cancelled || 0;

  const deliveryPct = delivery.deliveryRate ?? (totalRecipients > 0 ? ((delivered / totalRecipients) * 100).toFixed(1) : '100.0');

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold bg-white dark:bg-ink-800 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle">
        <div className="w-6 h-6 rounded-full border-2 border-scratchly-600 border-t-transparent animate-spin mx-auto mb-2"></div>
        <span>Loading performance analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white dark:bg-ink-800 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-ink-900 dark:text-white text-base">Outreach Performance</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Live Data
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Delivery rates, engagement metrics, and contact responses across all outreach campaigns
          </p>
        </div>
        <button
          onClick={() => {
            playHapticClick();
            loadAnalytics();
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-ink-900 dark:text-white text-xs font-bold transition-all self-start sm:self-auto active:scale-95 shadow-subtle cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5 text-scratchly-600" />
          <span>Refresh Stats</span>
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Contacts"
          value={contacts.total}
          subtitle={`${contacts.eligible} eligible for outreach`}
          icon={ShieldCheck}
          accentColor="scratchly"
          badge={`${contacts.suppressed} opt-outs`}
        />
        <StatCard
          title="Outreach Campaigns"
          value={campaigns.total}
          subtitle={`${campaigns.active} currently processing`}
          icon={Send}
          accentColor="amber"
          badge={`${campaigns.completed} completed`}
        />
        <StatCard
          title="Total Recipients"
          value={totalRecipients}
          subtitle={`${delivered} successfully delivered`}
          icon={CheckCircle2}
          accentColor="emerald"
          badge={`${deliveryPct}% success`}
        />
        <StatCard
          title="Suppressed / Opt-Out"
          value={contacts.suppressed}
          subtitle="Opt-outs & exclusion lists"
          icon={UserX}
          accentColor="rose"
          badge="Protected"
        />
      </div>

      {/* Recipient State Breakdown */}
      <div className="bg-white dark:bg-ink-800 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-floating overflow-hidden">
        {/* Mockup Window Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-ink-900/60 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="ml-2 font-mono text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[130px] xs:max-w-[200px] sm:max-w-none">
              Scratchly Mail › Delivery Breakdown
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-scratchly-700 dark:text-scratchly-300 shrink-0">
            <Sparkles className="w-3 h-3 text-scratchly-600" /> <span className="hidden xs:inline">Real-time Tracking</span>
          </span>
        </div>

        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-ink-900 dark:text-white text-sm">Recipient Delivery Breakdown</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Current status of all emails scheduled and sent across campaigns
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-ink-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
            Total Recipients: {totalRecipients}
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Delivered */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <span className="text-emerald-700 dark:text-emerald-300">Delivered Successfully</span>
              <span className="text-ink-900 dark:text-white">{delivered} ({totalRecipients > 0 ? Math.round((delivered / totalRecipients) * 100) : 0}%)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${totalRecipients > 0 ? (delivered / totalRecipients) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Queued */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <span className="text-amber-700 dark:text-amber-300">Queued for Delivery</span>
              <span className="text-ink-900 dark:text-white">{queued} ({totalRecipients > 0 ? Math.round((queued / totalRecipients) * 100) : 0}%)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${totalRecipients > 0 ? (queued / totalRecipients) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Sending */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <span className="text-scratchly-700 dark:text-scratchly-300">Currently Sending</span>
              <span className="text-ink-900 dark:text-white">{sending} ({totalRecipients > 0 ? Math.round((sending / totalRecipients) * 100) : 0}%)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div
                className="h-full bg-scratchly-600 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${totalRecipients > 0 ? (sending / totalRecipients) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Failed */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <span className="text-rose-700 dark:text-rose-300">Delivery Failed (Invalid Address)</span>
              <span className="text-ink-900 dark:text-white">{failed} ({totalRecipients > 0 ? Math.round((failed / totalRecipients) * 100) : 0}%)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${totalRecipients > 0 ? (failed / totalRecipients) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Cancelled */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <span className="text-slate-500 dark:text-slate-400">Cancelled</span>
              <span className="text-ink-900 dark:text-white">{cancelled} ({totalRecipients > 0 ? Math.round((cancelled / totalRecipients) * 100) : 0}%)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div
                className="h-full bg-slate-400 dark:bg-slate-600 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${totalRecipients > 0 ? (cancelled / totalRecipients) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
