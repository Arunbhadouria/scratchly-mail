import React from 'react';
import {
  LayoutDashboard,
  MailCheck,
  Users,
  Send,
  FileText,
  BarChart3,
  Settings,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type NavTab = 'overview' | 'connections' | 'contacts' | 'campaigns' | 'templates' | 'analytics' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
}) => {
  const { playHapticClick } = useTheme();

  const navItems: Array<{ id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: string }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'connections', label: 'Mailbox', icon: MailCheck },
    { id: 'contacts', label: 'Contacts & Candidates', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Send },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleTabClick = (id: NavTab) => {
    playHapticClick();
    setActiveTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-ink-900/60 dark:bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-ink-900 border-r border-slate-200/90 dark:border-slate-800/90 flex flex-col transition-all duration-300 ease-in-out shadow-subtle ${
          isMobileOpen
            ? 'translate-x-0 w-72 max-w-[85vw]'
            : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Brand Header */}
        <div
          className={`border-b border-slate-200/80 dark:border-slate-800/80 flex items-center transition-all ${
            isCollapsed ? 'p-4 lg:p-4 lg:justify-center' : 'p-4 sm:p-6 justify-between'
          }`}
        >
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleTabClick('overview');
            }}
            className={`group flex items-center transition-transform duration-200 hover:scale-[1.02] focus:outline-none ${
              isCollapsed ? 'lg:justify-center' : 'gap-3'
            }`}
            title="Scratchly Mail"
          >
            <img
              src="https://res.cloudinary.com/dch4tdddp/image/upload/v1769509934/logo_mv6mmf.png"
              alt="Scratchly Logo"
              className="h-9 w-9 object-contain rounded-xl shadow-sm shrink-0"
            />
            <div className={`${isCollapsed ? 'lg:hidden' : 'block'}`}>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg text-ink-900 dark:text-white tracking-tight">Scratchly</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 border border-scratchly-200 dark:border-scratchly-800">
                  MAIL
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Intelligent Email Outreach</p>
            </div>
          </a>

          {/* Close button inside mobile drawer */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-ink-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 sm:py-6 space-y-1.5 overflow-y-auto overflow-x-hidden">
          <div
            className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${
              isCollapsed ? 'lg:hidden' : 'block'
            }`}
          >
            Workspace
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                title={item.label}
                className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isCollapsed
                    ? 'lg:justify-center lg:p-3 p-3.5 justify-between'
                    : 'px-3.5 py-2.5 justify-between'
                } ${
                  isActive
                    ? 'bg-scratchly-600 text-white shadow-sm hover:shadow-glow-blue font-bold scale-[1.01]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-ink-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-800/80'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'lg:justify-center gap-0' : 'gap-3'}`}>
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'block'}`}>
                    {item.label}
                  </span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      isCollapsed ? 'lg:hidden' : 'block'
                    } ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/50 dark:text-scratchly-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Scratchly CRM Card */}
        <div className={`p-3 m-3 rounded-2xl bg-slate-50 dark:bg-ink-800/90 border border-slate-200/80 dark:border-slate-800 shadow-subtle ${isCollapsed ? 'lg:hidden' : 'block'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-ink-900 dark:text-white">Scratchly CRM</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-scratchly-700 dark:text-scratchly-300 bg-scratchly-50 dark:bg-scratchly-900/40 px-2 py-0.5 rounded-full border border-scratchly-200 dark:border-scratchly-800">
              <Sparkles className="w-2.5 h-2.5 text-scratchly-600" /> Active
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2.5">
            Seamlessly sync contacts, candidate statuses, and engagement.
          </p>
          <a
            href="https://www.scratchlycrm.app/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={playHapticClick}
            className="inline-flex items-center gap-1 text-xs text-scratchly-600 dark:text-scratchly-400 hover:text-scratchly-700 font-bold transition-colors"
          >
            scratchlycrm.app <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Privacy & Protection Footer */}
        <div
          className={`p-3.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-ink-900 ${
            isCollapsed ? 'lg:justify-center gap-0' : 'gap-2.5'
          }`}
          title="Encrypted & Secure Mailbox"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'block'}`}>
            Encrypted &amp; Secure
          </span>
        </div>
      </aside>
    </>
  );
};
