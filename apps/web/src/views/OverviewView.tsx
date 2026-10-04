import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { StatCard } from '../components/common/StatCard';
import { useTheme } from '../context/ThemeContext';
import {
  Users,
  Send,
  CheckCircle2,
  Plus,
  Upload,
  ArrowRight,
  Clock,
  ShieldCheck,
  RotateCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { NavTab } from '../components/common/Sidebar';

interface OverviewData {
  isDryRunMode: boolean;
  contacts: {
    total: number;
    active: number;
    eligible: number;
    suppressed: number;
    unsubscribed: number;
    bounced: number;
  };
  campaigns: {
    total: number;
    active: number;
    completed: number;
    draft: number;
    paused: number;
    cancelled: number;
    byStatus: Record<string, number>;
  };
  delivery: {
    totalRecipients: number;
    queued: number;
    sending: number;
    accepted: number;
    delivered: number;
    bounced: number;
    complained: number;
    failed: number;
    cancelled: number;
    suppressed: number;
    deliveryRate: number;
  };
  connectedAccounts: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    subject: string;
    status: string;
    templateName: string;
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    badgeColor: string;
  }>;
}

export const OverviewView: React.FC<{ setActiveTab: (tab: NavTab) => void }> = ({ setActiveTab }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { playHapticClick } = useTheme();

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    const res = await api.get<OverviewData>('/analytics/overview');
    if (res.success && res.data) {
      setData(res.data);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 border-scratchly-200 dark:border-scratchly-800 animate-pulse font-bold';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold';
      case 'PAUSED':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-ink-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const avatarInitials = ['AL', 'MK', 'TN', 'JD', 'TC', 'SJ'];

  const filteredCampaigns = (data?.recentCampaigns || []).filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'active') return c.status === 'IN_PROGRESS' || c.status === 'QUEUED';
    if (filter === 'completed') return c.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner: Status Notice */}
      <div className="p-4 rounded-2xl bg-white dark:bg-ink-800 border border-slate-200/90 dark:border-slate-800 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span>
            <strong className="text-ink-900 dark:text-white">Outreach Service Active:</strong> Candidate communications and email delivery are operating smoothly.
          </span>
        </div>
        <button
          onClick={() => {
            playHapticClick();
            loadOverview();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-ink-900 dark:hover:bg-ink-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all shrink-0 active:scale-95 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5 text-scratchly-600" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tactile Physical Hero Mockup Container */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/90 dark:border-slate-700/80 rounded-3xl shadow-floating overflow-hidden">
        {/* Mockup Window Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-ink-900/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-rose-400 shrink-0"></span>
            <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-amber-400 shrink-0"></span>
            <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="ml-2 sm:ml-3 text-[11px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 font-mono truncate max-w-[130px] xs:max-w-[200px] sm:max-w-none">
              Scratchly Mail › Outreach Overview
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-scratchly-700 dark:text-scratchly-300 shadow-subtle">
              <Sparkles className="w-3.5 h-3.5 text-scratchly-600" />
              <span className="hidden xs:inline">Workspace Ready</span>
            </span>
          </div>
        </div>

        {/* Pipeline Header & Metrics */}
        <div className="p-4 sm:p-6 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h3 className="text-xl sm:text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">
                  Candidate Outreach &amp; Campaigns
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 border border-scratchly-200 dark:border-scratchly-800">
                  {data?.campaigns.total ?? 0} Campaigns • {data?.delivery.delivered ?? 0} Delivered
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Track candidate email sequences, engagement metrics, and contact list health in one place.
              </p>
            </div>

            {/* Quick Action Bar: Search, Filter Tabs, + New Campaign */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Search input */}
              <div className="relative flex-1 xs:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter campaigns..."
                  className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600 w-full xs:w-36 sm:w-44 transition-all font-medium"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-ink-900 p-1 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800">
                <button
                  onClick={() => {
                    playHapticClick();
                    setFilter('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'all'
                      ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white shadow-subtle'
                      : 'hover:text-ink-900 dark:hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    playHapticClick();
                    setFilter('active');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'active'
                      ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white shadow-subtle'
                      : 'hover:text-ink-900 dark:hover:text-white'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => {
                    playHapticClick();
                    setFilter('completed');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filter === 'completed'
                      ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white shadow-subtle'
                      : 'hover:text-ink-900 dark:hover:text-white'
                  }`}
                >
                  Completed
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => {
                  playHapticClick();
                  setActiveTab('campaigns');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-scratchly-600 text-white font-bold text-xs hover:bg-scratchly-700 shadow-sm hover:shadow-glow-blue transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Campaign</span>
              </button>

              <button
                onClick={() => {
                  playHapticClick();
                  setActiveTab('contacts');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-ink-900 dark:text-white font-bold text-xs transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Import CSV</span>
              </button>
            </div>
          </div>

          {/* Goal & Delivery Funnel Meter */}
          <div className="bg-slate-50 dark:bg-ink-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-ink-900 dark:text-white">Delivery Success Rate:</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {data?.delivery.delivered ?? 0} of {data?.delivery.totalRecipients ?? 0} recipients reached (
                {data?.delivery.deliveryRate ?? 100}%)
              </span>
            </div>
            <div className="w-full sm:w-72 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden flex-shrink-0">
              <div
                className="bg-gradient-to-r from-scratchly-600 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, Math.max(8, data?.delivery.deliveryRate ?? 92))}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Contacts"
          value={data?.contacts.total ?? 0}
          subtitle={`${data?.contacts.eligible ?? 0} active, ${data?.contacts.suppressed ?? 0} unsubscribed`}
          icon={Users}
          accentColor="scratchly"
          badge={`${data?.contacts.unsubscribed ?? 0} opted-out`}
        />
        <StatCard
          title="Active Campaigns"
          value={data?.campaigns.total ?? 0}
          subtitle={`${data?.campaigns.active ?? 0} sending, ${data?.campaigns.completed ?? 0} completed`}
          icon={Send}
          accentColor="amber"
          badge={`${data?.campaigns.draft ?? 0} drafts`}
        />
        <StatCard
          title="Delivered Emails"
          value={data?.delivery.delivered ?? 0}
          subtitle={`${data?.delivery.deliveryRate ?? 100}% delivery rate`}
          icon={CheckCircle2}
          accentColor="emerald"
          badge="Verified Sent"
        />
        <StatCard
          title="Opt-Out Protection"
          value={data?.contacts.suppressed ?? 0}
          subtitle="Protected from unintended outreach"
          icon={ShieldCheck}
          accentColor="purple"
          badge="Compliance Guard"
        />
      </div>

      {/* Two Column Layout: Recent Campaigns & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recent Campaigns Table */}
        <div className="lg:col-span-2 bg-white dark:bg-ink-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-extrabold text-ink-900 dark:text-white text-base">Recent Outreach Campaigns</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Campaign delivery progress and candidate reach</p>
            </div>
            <button
              onClick={() => {
                playHapticClick();
                setActiveTab('campaigns');
              }}
              className="text-xs text-scratchly-600 dark:text-scratchly-400 hover:text-scratchly-700 font-bold flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">
              No campaigns matching your current filter. Start by launching a new outreach campaign.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[550px]">
                <thead className="bg-slate-50 dark:bg-ink-900 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Delivered</th>
                    <th className="px-4 py-3">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCampaigns.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-ink-700/50 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-ink-900 dark:text-white">
                        {c.name}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-[200px]">
                          {c.subject}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-medium">{c.templateName}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(c.status)}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-extrabold text-ink-900 dark:text-white">{c.deliveredCount}</span>
                        <span className="text-slate-400"> / {c.totalRecipients}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center">
                          {avatarInitials[idx % avatarInitials.length]}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-white dark:bg-ink-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-ink-900 dark:text-white text-base">Recent Activity</h3>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
              Chronological history of candidate outreach and team updates
            </p>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {!data?.recentActivity || data.recentActivity.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No activity recorded yet.</div>
              ) : (
                data.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-ink-900 dark:text-white capitalize">{act.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{act.description}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Activity record</span>
            <span
              className="text-scratchly-600 dark:text-scratchly-400 hover:text-scratchly-700 cursor-pointer"
              onClick={() => {
                playHapticClick();
                setActiveTab('analytics');
              }}
            >
              View Analytics →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
