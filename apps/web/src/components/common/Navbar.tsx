import React from 'react';
import { Menu, LogOut, ShieldCheck, Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NavTab } from './Sidebar';

interface NavbarProps {
  activeTab: NavTab;
  toggleSidebar: () => void;
  isCollapsed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, toggleSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, soundEnabled, toggleSound, playHapticClick } = useTheme();

  const tabTitles: Record<NavTab, { title: string; subtitle: string; path: string }> = {
    overview: { title: 'Dashboard Overview', subtitle: 'Summary of outreach campaigns, recent activity, and team engagement', path: 'Scratchly Mail › Overview' },
    connections: { title: 'Email Mailbox', subtitle: 'Connected Gmail inbox, recent messages, and conversations', path: 'Scratchly Mail › Mailbox' },
    contacts: { title: 'Contacts & Candidates', subtitle: 'Manage contact directory, candidate lists, and communication preferences', path: 'Scratchly Mail › Contacts' },
    campaigns: { title: 'Email Campaigns', subtitle: 'Create, schedule, and send targeted email outreach', path: 'Scratchly Mail › Campaigns' },
    templates: { title: 'Email Templates', subtitle: 'Reusable message templates with personalized candidate fields', path: 'Scratchly Mail › Templates' },
    analytics: { title: 'Outreach Analytics', subtitle: 'Review delivery performance, open rates, and candidate responses', path: 'Scratchly Mail › Analytics' },
    settings: { title: 'Settings & Privacy', subtitle: 'Organization profile, account security, and CRM connection', path: 'Scratchly Mail › Settings' },
  };

  const current = tabTitles[activeTab] || { title: 'Dashboard', subtitle: '', path: 'Scratchly Mail › Workspace' };

  return (
    <header className="bg-white/95 dark:bg-ink-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90 px-3 sm:px-6 py-2.5 sm:py-3.5 sticky top-0 z-30 transition-colors duration-200 shadow-subtle">
      {/* Top Mockup Window Indicator Bar */}
      <div className="flex items-center justify-between pb-2 sm:pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800/60 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="ml-1 sm:ml-2 font-mono text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-[140px] xs:max-w-[220px] sm:max-w-none">
            {current.path}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Sound micro-haptics toggle */}
          <button
            onClick={() => {
              toggleSound();
              if (!soundEnabled) playHapticClick();
            }}
            aria-label="Toggle sound feedback"
            title={soundEnabled ? 'Click sound feedback enabled' : 'Click sound feedback muted'}
            className="p-1.5 text-slate-400 hover:text-ink-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-800 rounded-lg transition-all focus:outline-none cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-scratchly-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Light / Dark Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-ink-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-800 rounded-lg transition-all focus:outline-none cursor-pointer"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Main Navbar Row */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Universal Hamburger Toggle Button (Works on Desktop & Mobile) */}
          <button
            onClick={() => {
              playHapticClick();
              toggleSidebar();
            }}
            className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors cursor-pointer shrink-0"
            aria-label="Toggle Sidebar"
            title="Toggle Sidebar Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-extrabold text-ink-900 dark:text-white tracking-tight truncate">
              {current.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">
              {current.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Delivery Service Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Outreach Service Ready</span>
          </div>

          {/* Tenant Pill */}
          {user && (
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-ink-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-scratchly-600" />
              <span className="font-semibold text-ink-900 dark:text-white">{user.tenantName}</span>
              <span className="px-1.5 py-0.5 rounded bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 text-[10px] font-bold">
                {user.role}
              </span>
            </div>
          )}

          {/* User Profile & Logout */}
          {user && (
            <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-scratchly-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0"
                  title={user.email}
                >
                  {user.name ? user.name.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-ink-900 dark:text-white leading-tight truncate max-w-[120px]">
                    {user.name || user.email}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[120px]">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  playHapticClick();
                  logout();
                }}
                title="Sign Out"
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
