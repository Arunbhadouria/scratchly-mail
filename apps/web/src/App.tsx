import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { Navbar } from './components/common/Navbar';
import { OverviewView } from './views/OverviewView';
import { ConnectionsView } from './views/ConnectionsView';
import { ContactsView } from './views/ContactsView';
import { CampaignsView } from './views/CampaignsView';
import { TemplatesView } from './views/TemplatesView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { LoginView } from './views/LoginView';

const DashboardContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['overview', 'connections', 'contacts', 'campaigns', 'templates', 'analytics', 'settings'].includes(tab)) {
      return tab as NavTab;
    }
    if (params.has('connected') || params.has('error')) {
      return 'connections';
    }
    return 'overview';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
          <div className="w-8 h-8 rounded-full border-2 border-scratchly-600 border-t-transparent animate-spin"></div>
          <span className="font-semibold">Loading Scratchly Mail...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewView setActiveTab={setActiveTab} />;
      case 'connections':
        return <ConnectionsView />;
      case 'contacts':
        return <ContactsView />;
      case 'campaigns':
        return <CampaignsView />;
      case 'templates':
        return <TemplatesView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex flex-col lg:flex-row overflow-x-hidden transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileSidebarOpen(false);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Navbar
          activeTab={activeTab}
          toggleSidebar={handleToggleSidebar}
          isCollapsed={isSidebarCollapsed}
        />
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
