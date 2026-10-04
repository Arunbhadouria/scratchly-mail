import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ShieldCheck,
  ExternalLink,
  Layers,
  Lock,
  Copy,
  Check,
  Mail,
  Send,
  Sparkles,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const { playHapticClick } = useTheme();
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    playHapticClick();
    if (user?.tenantId) {
      navigator.clipboard.writeText(user.tenantId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Mockup Header Card */}
      <div className="bg-white dark:bg-ink-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-subtle overflow-hidden">
        {/* Tactile Window Bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-ink-900/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/90 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/90 shrink-0" />
            <span className="ml-2 font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[140px] xs:max-w-[220px] sm:max-w-none">
              Scratchly Mail › Settings &amp; Preferences
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Account Protected</span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white tracking-tight">
                Organization Settings &amp; Privacy
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Manage your organization profile, email deliverability settings, privacy safeguards, and CRM sync.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Workspace Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Profile */}
      <div className="bg-white dark:bg-ink-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-subtle p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-scratchly-50 dark:bg-scratchly-950/40 border border-scratchly-200/60 dark:border-scratchly-800/40 text-scratchly-600 dark:text-scratchly-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Organization &amp; Team</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Your organization details and team access role</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Organization Name</span>
            <p className="font-bold text-slate-900 dark:text-white text-sm mt-1">{user?.tenantName || 'Scratchly Team'}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-slate-400 dark:text-slate-500 font-medium">Workspace ID</span>
              <p className="font-mono text-scratchly-600 dark:text-scratchly-400 text-xs mt-1 truncate">
                {user?.tenantId}
              </p>
            </div>
            <button
              onClick={handleCopyId}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
              title="Copy Workspace ID"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Your Role</span>
            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-1 capitalize">
              {user?.role || 'Administrator'}
            </p>
          </div>
        </div>
      </div>

      {/* Privacy & Email Protection */}
      <div className="bg-white dark:bg-ink-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-subtle p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Privacy &amp; Data Safeguards</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enterprise security standards protecting your email accounts and candidate communications
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Account Credentials</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" /> Securely Stored &amp; Protected
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Candidate Privacy &amp; Opt-Out</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
              Automated Unsubscribe Compliance
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Data Isolation</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
              Private Workspace Partition
            </span>
          </div>
        </div>
      </div>

      {/* Email Delivery & Performance */}
      <div className="bg-white dark:bg-ink-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-subtle p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-600 dark:text-amber-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Delivery &amp; Inbox Placement</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Optimized delivery infrastructure ensuring your outreach reaches the primary inbox
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <Mail className="w-3.5 h-3.5 text-scratchly-600" />
              <span>Outreach Deliverability</span>
            </div>
            <div className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <p className="flex justify-between">
                <span>Domain Protection:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">Reputation Shield Active</span>
              </p>
              <p className="flex justify-between">
                <span>Bounce Management:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">Automatic Suppression</span>
              </p>
              <p className="flex justify-between">
                <span>Sender Verification:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Authorized</span>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Smart Delivery Pacing</span>
            </div>
            <div className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <p className="flex justify-between">
                <span>Sending Schedule:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">Distributed Pacing</span>
              </p>
              <p className="flex justify-between">
                <span>Rate Compliance:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">Provider Standards</span>
              </p>
              <p className="flex justify-between">
                <span>Queue Health:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Operational</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scratchly CRM Integration */}
      <div className="bg-white dark:bg-ink-850 rounded-2xl border border-scratchly-200 dark:border-scratchly-800/40 shadow-card p-4 sm:p-6 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-scratchly-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Scratchly CRM Synchronization
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connected to Scratchly CRM for automatic contact and candidate updates
              </p>
            </div>
          </div>
          <a
            href="https://www.scratchlycrm.app/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={playHapticClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-semibold shadow-sm hover:shadow-glow-blue transition active:scale-95"
          >
            <span>Open Scratchly CRM</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2 relative z-10">
          <p className="leading-relaxed">
            Your Scratchly Mail workspace automatically synchronizes with{' '}
            <strong className="text-slate-900 dark:text-white font-semibold">Scratchly CRM</strong>:
          </p>
          <ul className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
            <li className="flex items-start gap-2">
              <span className="text-scratchly-600 font-bold">•</span>
              <span>Candidate and contact records stay updated across both applications in real time.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-scratchly-600 font-bold">•</span>
              <span>Email engagement (opens, clicks, and replies) is linked directly to candidate profiles.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-scratchly-600 font-bold">•</span>
              <span>Single sign-on allows team members to access mail outreach without separate credentials.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
