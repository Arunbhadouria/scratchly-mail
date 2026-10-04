import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useTheme } from '../context/ThemeContext';
import {
  MailCheck,
  ShieldCheck,
  Send,
  FileEdit,
  Trash2,
  RefreshCw,
  Inbox,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  UserPlus,
  Reply,
  HelpCircle,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Eye,
  Sparkles,
} from 'lucide-react';

interface ConnectionStatusData {
  configured: boolean;
  connected: boolean;
  status: string;
  connection?: {
    id: string;
    emailAddress: string;
    status: string;
    scopes: string[];
    connectedBy?: string;
    lastSyncAt: string | null;
    createdAt: string;
  } | null;
}

interface ContactMatch {
  found: boolean;
  contact?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string;
    phone: string | null;
    status: string;
  };
}

interface MessageItem {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  contactMatch: ContactMatch;
}

interface MessageDetail extends MessageItem {
  bodyHtml: string;
  bodyText: string;
  messageIdHeader?: string;
  inReplyToHeader?: string;
}

export const ConnectionsView: React.FC = () => {
  const { playHapticClick } = useTheme();
  const [connectionData, setConnectionData] = useState<ConnectionStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Message for Detail Modal
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [bodyFormat, setBodyFormat] = useState<'html' | 'text'>('html');

  // Send Email Modal (2-step Review & Send)
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', subject: '', bodyHtml: '' });
  const [sendReviewOpen, setSendReviewOpen] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);

  // Reply Modal (2-step Review & Send)
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replyForm, setReplyForm] = useState({ threadId: '', to: '', subject: '', bodyHtml: '' });
  const [replyReviewOpen, setReplyReviewOpen] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);

  // Draft Modal
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState({ to: '', subject: '', bodyHtml: '' });
  const [draftLoading, setDraftLoading] = useState(false);

  // Create Contact Modal (from Gmail sender)
  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
  });
  const [createContactLoading, setCreateContactLoading] = useState(false);

  // Setup Instructions Modal
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // URL Feedback message from OAuth callback redirect
  const [urlMessage, setUrlMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      const email = params.get('email');
      return {
        type: 'success',
        text: email ? `Gmail account (${email}) connected successfully!` : 'Gmail account connected successfully!',
      };
    }
    const err = params.get('error');
    if (err) {
      return { type: 'error', text: decodeURIComponent(err) };
    }
    return null;
  });

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get<ConnectionStatusData>('/integrations/gmail/status');
      if (res.success && res.data) {
        setConnectionData(res.data);
        if (res.data.connected) {
          loadMessages();
        }
      }
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (query = '') => {
    setLoadingMessages(true);
    try {
      const res = await api.get<{ messages: MessageItem[]; count: number }>('/integrations/gmail/messages', {
        q: query || undefined,
        limit: 20,
      });
      if (res.success && res.data) {
        setMessages(res.data.messages || []);
      }
    } catch {
      // Handled silently
    } finally {
      setLoadingMessages(false);
    }
  };

  // Start Google OAuth flow
  const handleConnectGoogle = async () => {
    playHapticClick();
    try {
      const res = await api.get<{ authUrl?: string; url?: string }>('/integrations/gmail/connect');
      const targetUrl = res.data?.authUrl || res.data?.url;
      if (res.success && targetUrl) {
        window.location.href = targetUrl;
      } else {
        alert(
          res.error ||
          (res as any).message ||
          'Failed to initialize Google OAuth flow. Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured in your backend environment variables.'
        );
      }
    } catch (err: any) {
      alert(err.message || 'Error connecting to Google OAuth');
    }
  };

  // Disconnect Gmail
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Gmail account? Stored tokens will be permanently scrubbed.')) {
      return;
    }
    playHapticClick();
    try {
      const res = await api.post('/integrations/gmail/disconnect', {});
      if (res.success) {
        setConnectionData((prev) => (prev ? { ...prev, connected: false, status: 'DISCONNECTED', connection: null } : null));
        setMessages([]);
        alert('Gmail account disconnected successfully.');
      } else {
        alert(res.error || 'Failed to disconnect Gmail account');
      }
    } catch (err: any) {
      alert(err.message || 'Error disconnecting account');
    }
  };

  // Open Message Detail
  const handleOpenMessage = async (msg: MessageItem) => {
    playHapticClick();
    setSelectedMessage(null);
    setLoadingDetail(true);
    setBodyFormat('html');
    try {
      const res = await api.get<MessageDetail>(`/integrations/gmail/messages/${msg.id}`);
      if (res.success && res.data) {
        setSelectedMessage(res.data);
      } else {
        alert(res.error || 'Failed to fetch message detail');
      }
    } catch (err: any) {
      alert(err.message || 'Error opening message');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Add Contact modal pre-populated from Gmail sender
  const handleOpenAddContact = (email: string, name: string) => {
    playHapticClick();
    const parts = name.trim().split(' ');
    setContactForm({
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email,
      company: '',
      phone: '',
    });
    setIsCreateContactOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    playHapticClick();
    setCreateContactLoading(true);
    try {
      const res = await api.post<{ id: string }>('/contacts', contactForm);
      if (res.success) {
        setIsCreateContactOpen(false);
        if (selectedMessage) {
          setSelectedMessage((prev) =>
            prev
              ? {
                  ...prev,
                  contactMatch: {
                    found: true,
                    contact: {
                      id: res.data!.id,
                      firstName: contactForm.firstName,
                      lastName: contactForm.lastName,
                      company: contactForm.company,
                      email: contactForm.email,
                      phone: contactForm.phone,
                      status: 'ACTIVE',
                    },
                  },
                }
              : null
          );
        }
        loadMessages(searchQuery);
        alert('Contact created successfully in your Scratchly CRM database!');
      } else {
        alert(res.error || 'Failed to create contact');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating contact');
    } finally {
      setCreateContactLoading(false);
    }
  };

  // Initialize Reply
  const handleStartReply = (msg: MessageDetail) => {
    playHapticClick();
    const subject = msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`;
    setReplyForm({
      threadId: msg.threadId,
      to: msg.fromEmail,
      subject,
      bodyHtml: `<p><br/></p><blockquote style="border-left: 2px solid #0066ff; padding-left: 10px; color: #64748b; margin: 10px 0;">On ${msg.date}, ${msg.from} wrote:<br/>${msg.bodyHtml || msg.bodyText}</blockquote>`,
    });
    setIsReplyOpen(true);
  };

  // Submit Reply after Review
  const handleConfirmReply = async () => {
    playHapticClick();
    setReplyLoading(true);
    try {
      const res = await api.post('/integrations/gmail/reply', replyForm);
      if (res.success) {
        setReplyReviewOpen(false);
        setIsReplyOpen(false);
        setSelectedMessage(null);
        alert('Reply dispatched successfully via your authorized Gmail account!');
        loadMessages(searchQuery);
      } else {
        alert(res.error || 'Failed to dispatch reply');
      }
    } catch (err: any) {
      alert(err.message || 'Error sending reply');
    } finally {
      setReplyLoading(false);
    }
  };

  // Submit Individual Send after Review
  const handleConfirmSend = async () => {
    playHapticClick();
    setSendLoading(true);
    try {
      const res = await api.post('/integrations/gmail/send', sendForm);
      if (res.success) {
        setSendReviewOpen(false);
        setIsSendOpen(false);
        setSendForm({ to: '', subject: '', bodyHtml: '' });
        alert('Individual email dispatched successfully via Gmail!');
        loadMessages(searchQuery);
      } else {
        alert(res.error || 'Failed to send individual email');
      }
    } catch (err: any) {
      alert(err.message || 'Error sending email');
    } finally {
      setSendLoading(false);
    }
  };

  // Create Draft
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    playHapticClick();
    setDraftLoading(true);
    try {
      const res = await api.post('/integrations/gmail/drafts', draftForm);
      if (res.success) {
        setIsDraftOpen(false);
        setDraftForm({ to: '', subject: '', bodyHtml: '' });
        alert('Draft saved in your authorized Gmail account!');
      } else {
        alert(res.error || 'Failed to save draft');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving draft');
    } finally {
      setDraftLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">
        <div className="w-8 h-8 rounded-full border-2 border-scratchly-600 border-t-transparent animate-spin mx-auto mb-3"></div>
        <span>Checking Gmail connection status...</span>
      </div>
    );
  }

  const isConfigured = connectionData?.configured ?? true;
  const isConnected = connectionData?.connected ?? false;
  const isReauthRequired = connectionData?.status === 'REAUTH_REQUIRED';
  const connection = connectionData?.connection;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alert Notifications */}
      {urlMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            urlMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5 font-medium">
            {urlMessage.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{urlMessage.text}</span>
          </div>
          <button onClick={() => setUrlMessage(null)} className="text-slate-400 hover:text-ink-900 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* 1. NOT CONFIGURED BANNER */}
      {!isConfigured && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Gmail Integration Is Not Configured</h3>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-1 font-medium">
                Google OAuth credentials (<code className="font-mono text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> and <code className="font-mono text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code>) are missing or set to placeholder values.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playHapticClick();
              setIsSetupModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors shrink-0 shadow-sm"
          >
            <HelpCircle className="w-4 h-4" /> Setup Instructions
          </button>
        </div>
      )}

      {/* 2. REAUTH REQUIRED BANNER */}
      {isReauthRequired && (
        <div className="p-5 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Gmail Re-authentication Required</h3>
              <p className="text-xs text-rose-800 dark:text-rose-400 mt-1 font-medium">
                Your authorization token has expired or was revoked by Google. Reconnect your account to resume mailbox operations.
              </p>
            </div>
          </div>
          <button
            onClick={handleConnectGoogle}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shrink-0 shadow-sm active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Reconnect Gmail
          </button>
        </div>
      )}

      {/* 3. MAIN CONNECTION CARD (Tactile Scratchly CRM styling) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-ink-800 border border-slate-200/90 dark:border-slate-800 shadow-floating space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-subtle ${
              isConnected
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-ink-900 text-slate-500'
            }`}>
              <MailCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-ink-900 dark:text-white tracking-tight">Google Gmail Account</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isConnected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : isReauthRequired
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-slate-100 text-slate-600 dark:bg-ink-900 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}>
                  {isConnected ? 'Connected' : isReauthRequired ? 'Reauth Required' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {isConnected && connection?.emailAddress
                  ? `Authorized as ${connection.emailAddress}`
                  : 'Personal Gmail integration for individual communication & inbox management'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isConnected ? (
              <button
                onClick={handleConnectGoogle}
                disabled={!isConfigured}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-40 active:scale-95"
              >
                <MailCheck className="w-4 h-4" /> Connect Gmail
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    playHapticClick();
                    setIsSendOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" /> Compose
                </button>
                <button
                  onClick={() => {
                    playHapticClick();
                    loadMessages(searchQuery);
                  }}
                  className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Refresh Mailbox"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin text-scratchly-600' : ''}`} />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold transition-all active:scale-95"
                  title="Disconnect Account"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        {/* Connection Metadata Pill */}
        {isConnected && connection && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Google Account</span>
              <span className="text-ink-900 dark:text-white font-extrabold truncate block mt-0.5">{connection.emailAddress}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Security &amp; Privacy</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Secure &amp; Protected
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Last Synchronized</span>
              <span className="text-slate-700 dark:text-slate-300 font-bold block mt-0.5">
                {connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : 'Just now'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. GMAIL MAILBOX & MESSAGES LIST */}
      {isConnected && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-scratchly-600" />
              <h3 className="text-sm font-extrabold text-ink-900 dark:text-white tracking-tight">Recent Messages</h3>
              <span className="text-[11px] text-slate-400 font-bold">({messages.length} messages)</span>
            </div>

            {/* Search Query */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                playHapticClick();
                loadMessages(searchQuery);
              }}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search sender, subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-ink-900 dark:text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Search
              </button>
            </form>
          </div>

          {loadingMessages ? (
            <div className="p-12 text-center text-xs text-slate-500 font-semibold bg-white dark:bg-ink-800 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle">
              <div className="w-6 h-6 rounded-full border-2 border-scratchly-600 border-t-transparent animate-spin mx-auto mb-2"></div>
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              title="No Messages Found"
              description={searchQuery ? 'No messages matched your search query.' : 'Your inbox is empty or no messages were returned.'}
              icon={Inbox}
            />
          ) : (
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-ink-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-floating">
              {/* Window Mockup Traffic Lights Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-ink-900/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span className="ml-2 font-mono text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[140px] sm:max-w-none">
                    Scratchly Mail › Gmail Inbox
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-scratchly-700 dark:text-scratchly-300 shrink-0">
                  <Sparkles className="w-3 h-3 text-scratchly-600" /> <span className="hidden xs:inline">Mailbox Synchronized</span>
                </span>
              </div>

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleOpenMessage(msg)}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-ink-700/50 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-scratchly-50 text-scratchly-700 dark:bg-ink-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-scratchly-200/60 dark:border-slate-700 shadow-subtle">
                      {(msg.fromName || msg.fromEmail || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-ink-900 dark:text-white truncate">{msg.fromName || msg.fromEmail}</span>
                        {/* Contact Matching Badge */}
                        {msg.contactMatch.found ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <UserCheck className="w-3 h-3 text-emerald-600" /> Contact Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-ink-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Not in contacts
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 font-semibold truncate mt-0.5">{msg.subject}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 font-medium">{msg.snippet}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    <span className="text-[11px] text-slate-400 font-medium">{msg.date}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-scratchly-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. MESSAGE DETAIL MODAL */}
      <Modal
        isOpen={!!selectedMessage || loadingDetail}
        onClose={() => setSelectedMessage(null)}
        title={selectedMessage ? selectedMessage.subject : 'Loading Message...'}
      >
        {loadingDetail ? (
          <div className="p-8 text-center text-xs text-slate-500 font-semibold">
            <div className="w-6 h-6 rounded-full border-2 border-scratchly-600 border-t-transparent animate-spin mx-auto mb-2"></div>
            <span>Fetching full message from Gmail...</span>
          </div>
        ) : selectedMessage ? (
          <div className="space-y-4">
            {/* Headers */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">From:</span>
                <span className="text-ink-900 dark:text-white font-bold">{selectedMessage.from}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">To:</span>
                <span className="text-slate-700 dark:text-slate-200 font-medium">{selectedMessage.to || 'Me'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Date:</span>
                <span className="text-slate-500 dark:text-slate-300 font-medium">{selectedMessage.date}</span>
              </div>
            </div>

            {/* Contact Matching Section */}
            <div className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-ink-900 border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                {selectedMessage.contactMatch.found ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-extrabold text-emerald-700 dark:text-emerald-300">
                        {selectedMessage.contactMatch.contact?.firstName} {selectedMessage.contactMatch.contact?.lastName}
                        {selectedMessage.contactMatch.contact?.company && ` • ${selectedMessage.contactMatch.contact.company}`}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Saved Contact in Scratchly ({selectedMessage.contactMatch.contact?.status})
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-ink-800 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-ink-900 dark:text-white">Contact not in directory</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{selectedMessage.fromEmail} is not yet saved</div>
                    </div>
                  </>
                )}
              </div>

              {!selectedMessage.contactMatch.found && (
                <button
                  onClick={() => handleOpenAddContact(selectedMessage.fromEmail, selectedMessage.fromName)}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white font-bold text-xs transition-all shrink-0 shadow-sm hover:shadow-glow-blue active:scale-95 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Save Contact
                </button>
              )}
            </div>

            {/* Body View Format Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Message Content</span>
              <div className="flex rounded-xl bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    playHapticClick();
                    setBodyFormat('html');
                  }}
                  className={`px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                    bodyFormat === 'html' ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white shadow-subtle' : 'text-slate-500 hover:text-ink-900'
                  }`}
                >
                  Formatted View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playHapticClick();
                    setBodyFormat('text');
                  }}
                  className={`px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                    bodyFormat === 'text' ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white shadow-subtle' : 'text-slate-500 hover:text-ink-900'
                  }`}
                >
                  Plain Text
                </button>
              </div>
            </div>

            {/* Sanitized Message Body */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 max-h-80 overflow-y-auto text-xs text-ink-900 dark:text-slate-200">
              {bodyFormat === 'html' && selectedMessage.bodyHtml ? (
                <div
                  className="prose prose-xs max-w-none text-ink-900 dark:text-slate-200 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 dark:text-slate-300">
                  {selectedMessage.bodyText || selectedMessage.snippet}
                </pre>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartReply(selectedMessage)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all active:scale-95"
                >
                  <Reply className="w-3.5 h-3.5" /> Reply to Thread
                </button>
                <button
                  onClick={() => {
                    playHapticClick();
                    setDraftForm({
                      to: selectedMessage.fromEmail,
                      subject: `Draft: ${selectedMessage.subject}`,
                      bodyHtml: '<p><br/></p>',
                    });
                    setIsDraftOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all active:scale-95"
                >
                  <FileEdit className="w-3.5 h-3.5" /> Create Draft
                </button>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 6. COMPOSE INDIVIDUAL EMAIL MODAL */}
      <Modal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} title="Compose Individual Email">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            playHapticClick();
            setSendReviewOpen(true);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">To <span className="text-rose-500">*</span></label>
            <input
              type="email"
              required
              placeholder="recipient@example.com"
              value={sendForm.to}
              onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Subject <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              placeholder="Email subject..."
              value={sendForm.subject}
              onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Message Body (HTML supported) <span className="text-rose-500">*</span></label>
            <textarea
              required
              rows={6}
              placeholder="Write your email here..."
              value={sendForm.bodyHtml}
              onChange={(e) => setSendForm({ ...sendForm, bodyHtml: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSendOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white font-bold shadow-sm hover:shadow-glow-blue transition-all active:scale-95"
            >
              Review & Send <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. REVIEW & SEND CONFIRMATION MODAL */}
      <Modal isOpen={sendReviewOpen} onClose={() => setSendReviewOpen(false)} title="Confirm Email Send">
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 flex items-start gap-2.5 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Ready to Send</span>
              <span>This email will be sent directly from your connected email account ({connection?.emailAddress}).</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div><span className="text-slate-400 font-semibold">Recipient:</span> <strong className="text-ink-900 dark:text-white">{sendForm.to}</strong></div>
            <div><span className="text-slate-400 font-semibold">Subject:</span> <strong className="text-ink-900 dark:text-white">{sendForm.subject}</strong></div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSendReviewOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 font-bold"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmSend}
              disabled={sendLoading}
              className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-all disabled:opacity-50 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" /> {sendLoading ? 'Sending email...' : 'Confirm & Send Now'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 8. REPLY MODAL (WITH REVIEW STEP) */}
      <Modal isOpen={isReplyOpen} onClose={() => setIsReplyOpen(false)} title="Reply to Gmail Thread">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            playHapticClick();
            setReplyReviewOpen(true);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">To</label>
            <input
              type="email"
              disabled
              value={replyForm.to}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-ink-900/60 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs cursor-not-allowed font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              required
              value={replyForm.subject}
              onChange={(e) => setReplyForm({ ...replyForm, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Your Reply <span className="text-rose-500">*</span></label>
            <textarea
              required
              rows={6}
              placeholder="Type your response..."
              value={replyForm.bodyHtml}
              onChange={(e) => setReplyForm({ ...replyForm, bodyHtml: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsReplyOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white font-bold shadow-sm hover:shadow-glow-blue transition-all active:scale-95"
            >
              Review Reply <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </Modal>

      {/* 9. REPLY REVIEW MODAL */}
      <Modal isOpen={replyReviewOpen} onClose={() => setReplyReviewOpen(false)} title="Confirm Reply">
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-scratchly-50 dark:bg-scratchly-950/40 border border-scratchly-200 dark:border-scratchly-800 text-scratchly-800 dark:text-scratchly-300 flex items-start gap-2.5 font-medium">
            <Shield className="w-4 h-4 text-scratchly-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Conversation Reply</span>
              <span>This message will be sent as a direct reply in the existing conversation thread.</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div><span className="text-slate-400 font-semibold">To:</span> <strong className="text-ink-900 dark:text-white">{replyForm.to}</strong></div>
            <div><span className="text-slate-400 font-semibold">Subject:</span> <strong className="text-ink-900 dark:text-white">{replyForm.subject}</strong></div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setReplyReviewOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 font-bold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmReply}
              disabled={replyLoading}
              className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-all disabled:opacity-50 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" /> {replyLoading ? 'Sending Reply...' : 'Confirm & Dispatch Reply'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 10. CREATE DRAFT MODAL */}
      <Modal isOpen={isDraftOpen} onClose={() => setIsDraftOpen(false)} title="Create Gmail Draft">
        <form onSubmit={handleSaveDraft} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">To</label>
            <input
              type="email"
              placeholder="recipient@example.com"
              value={draftForm.to}
              onChange={(e) => setDraftForm({ ...draftForm, to: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              placeholder="Draft Subject..."
              value={draftForm.subject}
              onChange={(e) => setDraftForm({ ...draftForm, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Draft Body</label>
            <textarea
              rows={5}
              placeholder="Write draft content..."
              value={draftForm.bodyHtml}
              onChange={(e) => setDraftForm({ ...draftForm, bodyHtml: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDraftOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={draftLoading}
              className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
            >
              <FileEdit className="w-3.5 h-3.5" /> {draftLoading ? 'Saving Draft...' : 'Save Draft in Gmail'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 11. CREATE CONTACT MODAL */}
      <Modal isOpen={isCreateContactOpen} onClose={() => setIsCreateContactOpen(false)} title="Add Gmail Sender to Contacts">
        <form onSubmit={handleSaveContact} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">First Name</label>
              <input
                type="text"
                value={contactForm.firstName}
                onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
            <div>
              <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Last Name</label>
              <input
                type="text"
                value={contactForm.lastName}
                onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Email <span className="text-rose-500">*</span></label>
            <input
              type="email"
              required
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div>
            <label className="block font-bold text-ink-900 dark:text-slate-300 mb-1">Company</label>
            <input
              type="text"
              placeholder="e.g. Acme Inc"
              value={contactForm.company}
              onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateContactOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createContactLoading || !contactForm.email}
              className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" /> {createContactLoading ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 12. SETUP INSTRUCTIONS MODAL */}
      <Modal isOpen={isSetupModalOpen} onClose={() => setIsSetupModalOpen(false)} title="Google Cloud OAuth Setup Guide">
        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>Follow these steps to generate valid Google OAuth credentials for Scratchly Mail:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Go to the <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-scratchly-600 dark:text-scratchly-400 font-bold underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a> and create or select a project.
            </li>
            <li>Enable the <strong>Gmail API</strong> in <em>APIs & Services &gt; Enabled APIs & Services</em>.</li>
            <li>Configure the <strong>OAuth Consent Screen</strong>: set user type to <em>External</em> and add your email as a test user.</li>
            <li>
              Create OAuth 2.0 Client ID Credentials:
              <ul className="list-disc pl-5 mt-1 text-slate-500 dark:text-slate-400 space-y-1">
                <li>Application type: <strong>Web application</strong></li>
                <li>Authorized redirect URI: <code className="text-scratchly-700 dark:text-scratchly-300 font-mono">http://localhost:4000/api/integrations/gmail/callback</code></li>
              </ul>
            </li>
            <li>
              Add the generated Client ID and Secret to your root <code className="text-scratchly-700 dark:text-scratchly-300 font-mono">.env</code>:
              <pre className="p-3 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-slate-200 mt-1 overflow-x-auto font-mono">
{`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/integrations/gmail/callback`}
              </pre>
            </li>
          </ol>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsSetupModalOpen(false)}
              className="px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white font-bold shadow-sm"
            >
              Got It
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
