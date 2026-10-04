import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useTheme } from '../context/ThemeContext';
import {
  Send,
  Plus,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Users,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  provider: 'SES_BULK' | 'DRY_RUN';
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  bounceCount: number;
  complaintCount: number;
  failedCount: number;
  template?: { id: string; name: string };
  createdAt: string;
  statusCounts?: Record<string, number>;
}

interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
}

interface AudiencePreflight {
  totalSelected: number;
  eligibleCount: number;
  suppressedCount: number;
  unsubscribedCount: number;
  invalidEmailCount: number;
  duplicateCount: number;
  finalSendableCount: number;
  sampleEligible: Array<{ id: string; email: string; name: string; company?: string }>;
  suppressionExclusions: Array<{ email: string; reason: string }>;
}

interface RecipientRow {
  id: string;
  email: string;
  personalizedSubject: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  lastError: string | null;
  providerMessageId: string | null;
  contact?: { firstName: string | null; lastName: string | null; company: string | null } | null;
}

export const CampaignsView: React.FC = () => {
  const { playHapticClick } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  // 4-Step Creation Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  const [wizardForm, setWizardForm] = useState({
    name: '',
    subject: '',
    templateId: '',
    provider: 'SES_BULK',
    dryRun: false,
  });
  const [wizardLoading, setWizardLoading] = useState(false);
  const [preflightData, setPreflightData] = useState<AudiencePreflight | null>(null);
  const [launchLoading, setLaunchLoading] = useState(false);

  // Campaign Details Drilldown Modal / View
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientsSearch, setRecipientsSearch] = useState('');
  const [recipientsStatusFilter, setRecipientsStatusFilter] = useState('');

  // Cancel Confirmation Modal
  const [campaignToCancel, setCampaignToCancel] = useState<Campaign | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    const res = await api.get<Campaign[]>('/campaigns');
    if (res.success && res.data) {
      setCampaigns(res.data);
    }
    setLoading(false);
  };

  const loadTemplates = async () => {
    const res = await api.get<TemplateOption[]>('/templates');
    if (res.success && res.data) {
      setTemplates(res.data);
    }
  };

  const handleOpenWizard = () => {
    playHapticClick();
    setWizardForm({
      name: '',
      subject: '',
      templateId: templates[0]?.id || '',
      provider: 'SES_BULK',
      dryRun: false,
    });
    setPreflightData(null);
    setCreatedCampaignId(null);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardForm.name.trim()) return;
    playHapticClick();
    setWizardStep(2);
  };

  const handleStep2Next = () => {
    if (!wizardForm.templateId) return;
    playHapticClick();
    setWizardStep(3);
  };

  const handleStep3Next = async () => {
    playHapticClick();
    setWizardLoading(true);

    try {
      let campId = createdCampaignId;
      if (!campId) {
        const selectedTemplate = templates.find((t) => t.id === wizardForm.templateId);
        const resolvedSubject = wizardForm.subject.trim() || selectedTemplate?.subject || wizardForm.name.trim();
        const createRes = await api.post<{ id: string }>('/campaigns', {
          name: wizardForm.name.trim(),
          subject: resolvedSubject,
          templateId: wizardForm.templateId && wizardForm.templateId.trim() !== '' ? wizardForm.templateId : undefined,
          provider: wizardForm.provider,
        });

        if (!createRes.success || !createRes.data) {
          alert(createRes.error || 'Failed to create campaign draft');
          setWizardLoading(false);
          return;
        }
        campId = createRes.data.id;
        setCreatedCampaignId(campId);
      }

      let preflightRes = await api.post<AudiencePreflight>(`/campaigns/${campId}/preflight`, {
        filter: {},
      });

      if (!preflightRes.success) {
        preflightRes = await api.get<AudiencePreflight>(`/campaigns/${campId}/audience`);
      }

      if (preflightRes.success && preflightRes.data) {
        setPreflightData(preflightRes.data);
        setWizardStep(4);
      } else {
        alert(preflightRes.error || 'Failed to calculate audience preflight');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing audience analysis');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!createdCampaignId) return;
    playHapticClick();
    setLaunchLoading(true);
    try {
      const res = await api.post<{ count: number }>(`/campaigns/${createdCampaignId}/launch`, {
        provider: wizardForm.provider,
        dryRun: wizardForm.provider === 'DRY_RUN',
        confirmRecipientCount: preflightData?.finalSendableCount || 0,
      });

      if (res.success) {
        setIsWizardOpen(false);
        loadCampaigns();
        alert(`Campaign launched successfully with ${res.data?.count || 0} queued recipients!`);
      } else {
        alert(res.error || 'Failed to launch campaign');
      }
    } catch (err: any) {
      alert(err.message || 'Error launching campaign');
    } finally {
      setLaunchLoading(false);
    }
  };

  const openCampaignDetail = async (id: string) => {
    playHapticClick();
    setDetailCampaign(null);
    const res = await api.get<Campaign>(`/campaigns/${id}`);
    if (res.success && res.data) {
      setDetailCampaign(res.data);
      loadRecipients(id, 1, '', '');
    }
  };

  const loadRecipients = async (campaignId: string, pageNum: number, searchQ: string, statusFilter: string) => {
    setRecipientsLoading(true);
    const res = await api.get<RecipientRow[]>(`/campaigns/${campaignId}/recipients`, {
      page: pageNum,
      limit: 10,
      search: searchQ || undefined,
      status: statusFilter || undefined,
    });
    if (res.success && res.data) {
      setRecipients(res.data);
      if (res.meta) {
        setRecipientsTotal(res.meta.total || 0);
        setRecipientsPage(res.meta.page || 1);
      }
    }
    setRecipientsLoading(false);
  };

  const refreshDetailCampaign = async (id: string) => {
    const res = await api.get<Campaign>(`/campaigns/${id}`);
    if (res.success && res.data) {
      setDetailCampaign(res.data);
    }
  };

  const handlePause = async (id: string) => {
    playHapticClick();
    const res = await api.post(`/campaigns/${id}/pause`, {});
    if (res.success) {
      loadCampaigns();
      if (detailCampaign?.id === id) refreshDetailCampaign(id);
    }
  };

  const handleResume = async (id: string) => {
    playHapticClick();
    const res = await api.post(`/campaigns/${id}/resume`, {});
    if (res.success) {
      loadCampaigns();
      if (detailCampaign?.id === id) refreshDetailCampaign(id);
    }
  };

  const handleConfirmCancel = async () => {
    if (!campaignToCancel) return;
    playHapticClick();
    setCancelLoading(true);
    const res = await api.post(`/campaigns/${campaignToCancel.id}/cancel`, {});
    setCancelLoading(false);

    if (res.success) {
      setCampaignToCancel(null);
      loadCampaigns();
      if (detailCampaign?.id === campaignToCancel.id) {
        refreshDetailCampaign(campaignToCancel.id);
        loadRecipients(campaignToCancel.id, recipientsPage, recipientsSearch, recipientsStatusFilter);
      }
    } else {
      alert(res.error || 'Failed to cancel campaign');
    }
  };

  const statusStyles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700 dark:bg-ink-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold',
    QUEUED: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold',
    IN_PROGRESS: 'bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 border-scratchly-200 dark:border-scratchly-800 animate-pulse font-bold',
    PAUSED: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold',
    COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold',
    CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold',
  };

  const recipientStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold';
      case 'ACCEPTED':
        return 'bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 border-scratchly-200 dark:border-scratchly-800 font-bold';
      case 'SENDING':
        return 'bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 border-scratchly-200 dark:border-scratchly-800 animate-pulse font-bold';
      case 'QUEUED':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-700 dark:bg-ink-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold';
      case 'FAILED':
      case 'BOUNCED':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-ink-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white dark:bg-ink-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-ink-900 dark:text-white text-base">Email Campaigns</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Ready to Send
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Create, schedule, and track multi-recipient candidate outreach sequences
          </p>
        </div>
        <button
          onClick={handleOpenWizard}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all active:scale-95 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New Campaign
        </button>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-subtle">
          <EmptyState
            icon={Send}
            title="No Campaigns Created"
            description="Create your first candidate outreach campaign with personalized templates and automated contact exclusion checks."
            actionText="Create Campaign"
            onAction={handleOpenWizard}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {campaigns.map((c) => {
            const delivered = c.deliveredCount;
            const total = c.totalRecipients || 1;
            const progressPct = c.status === 'COMPLETED' ? 100 : Math.min(100, Math.round((delivered / total) * 100));

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-ink-800 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 hover:border-scratchly-300 dark:hover:border-slate-700 shadow-subtle hover:shadow-card transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h4 className="font-extrabold text-ink-900 dark:text-white text-sm truncate">{c.name}</h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${statusStyles[c.status] || ''}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-ink-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {c.provider === 'SES_BULK' ? 'Direct Send' : 'Test Mode'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <div>
                      <span className="text-slate-400">Subject:</span> {c.subject}
                    </div>
                    {c.template && (
                      <div>
                        <span className="text-slate-400">Template:</span> {c.template.name}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Created:</span> {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Progress Bar with Scratchly Gradient */}
                  {c.totalRecipients > 0 && (
                    <div className="mt-3 max-w-md">
                      <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
                        <span className="text-slate-500 dark:text-slate-400">
                          Progress: <strong className="text-ink-900 dark:text-white">{delivered}</strong> / {c.totalRecipients} delivered
                        </span>
                        <span className="text-scratchly-600 dark:text-scratchly-400 font-bold">{progressPct}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-scratchly-600 to-emerald-500 transition-all duration-500 rounded-full"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    onClick={() => openCampaignDetail(c.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-ink-900 dark:text-white text-xs font-bold transition-all active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Details
                  </button>

                  {c.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handlePause(c.id)}
                      className="p-2 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-all active:scale-95"
                      title="Pause Campaign"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}

                  {c.status === 'PAUSED' && (
                    <button
                      onClick={() => handleResume(c.id)}
                      className="p-2 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all active:scale-95"
                      title="Resume Campaign"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}

                  {c.status !== 'COMPLETED' && c.status !== 'CANCELLED' && (
                    <button
                      onClick={() => setCampaignToCancel(c)}
                      className="p-2 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all active:scale-95"
                      title="Cancel Campaign"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4-Step Campaign Creation Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title={`Campaign Setup Wizard — Step ${wizardStep} of 4`}
      >
        <div className="space-y-5">
          {/* Step Indicator */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
            <div className={`p-2 rounded-xl border ${wizardStep >= 1 ? 'bg-scratchly-50 border-scratchly-300 text-scratchly-700 dark:bg-scratchly-950/60 dark:border-scratchly-800 dark:text-scratchly-300' : 'bg-slate-50 dark:bg-ink-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
              1. Details
            </div>
            <div className={`p-2 rounded-xl border ${wizardStep >= 2 ? 'bg-scratchly-50 border-scratchly-300 text-scratchly-700 dark:bg-scratchly-950/60 dark:border-scratchly-800 dark:text-scratchly-300' : 'bg-slate-50 dark:bg-ink-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
              2. Template
            </div>
            <div className={`p-2 rounded-xl border ${wizardStep >= 3 ? 'bg-scratchly-50 border-scratchly-300 text-scratchly-700 dark:bg-scratchly-950/60 dark:border-scratchly-800 dark:text-scratchly-300' : 'bg-slate-50 dark:bg-ink-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
              3. Audience
            </div>
            <div className={`p-2 rounded-xl border ${wizardStep >= 4 ? 'bg-scratchly-50 border-scratchly-300 text-scratchly-700 dark:bg-scratchly-950/60 dark:border-scratchly-800 dark:text-scratchly-300' : 'bg-slate-50 dark:bg-ink-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
              4. Pre-flight
            </div>
          </div>

          {/* STEP 1: Campaign Details */}
          {wizardStep === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">
                  Campaign Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Executive Product Intro"
                  value={wizardForm.name}
                  onChange={(e) => setWizardForm({ ...wizardForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">
                  Subject Line Override (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty to use template subject"
                  value={wizardForm.subject}
                  onChange={(e) => setWizardForm({ ...wizardForm, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
                />
              </div>

              {/* Execution & Delivery Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-2">
                  Delivery Option <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    onClick={() => {
                      playHapticClick();
                      setWizardForm({ ...wizardForm, dryRun: false, provider: 'SES_BULK' });
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      !wizardForm.dryRun
                        ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700 shadow-sm'
                        : 'bg-slate-50 dark:bg-ink-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink-900 dark:text-white text-xs flex items-center gap-1.5">
                        📬 Live Delivery
                      </span>
                      {!wizardForm.dryRun && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      Sends real emails directly to all selected candidate inboxes.
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      playHapticClick();
                      setWizardForm({ ...wizardForm, dryRun: true, provider: 'DRY_RUN' });
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      wizardForm.dryRun
                        ? 'bg-scratchly-50 border-scratchly-300 dark:bg-scratchly-950/40 dark:border-scratchly-700 shadow-sm'
                        : 'bg-slate-50 dark:bg-ink-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink-900 dark:text-white text-xs flex items-center gap-1.5">
                        🛡️ Safe Test Run (Preview)
                      </span>
                      {wizardForm.dryRun && <CheckCircle2 className="w-4 h-4 text-scratchly-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      Test delivery flow and check personalization without emailing candidates.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!wizardForm.name.trim()}
                  className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
                >
                  Next: Select Template <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Select Template */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300">
                Choose an Email Template <span className="text-rose-500">*</span>
              </label>

              {templates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-ink-900 rounded-2xl border border-slate-200 dark:border-slate-800 font-medium">
                  No templates found. Please create a template in the Template Library first.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        playHapticClick();
                        setWizardForm({ ...wizardForm, templateId: tpl.id, subject: wizardForm.subject || tpl.subject });
                      }}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        wizardForm.templateId === tpl.id
                          ? 'bg-scratchly-50 border-scratchly-300 dark:bg-scratchly-950/40 dark:border-scratchly-700 shadow-sm'
                          : 'bg-slate-50 dark:bg-ink-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink-900 dark:text-white text-xs">{tpl.name}</span>
                        {wizardForm.templateId === tpl.id && (
                          <CheckCircle2 className="w-4 h-4 text-scratchly-600" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-medium">
                        Subject: {tpl.subject}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    playHapticClick();
                    setWizardStep(1);
                  }}
                  className="flex items-center gap-1 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2Next}
                  disabled={!wizardForm.templateId}
                  className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
                >
                  Next: Select Audience <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Select Audience */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-ink-900 dark:text-white font-bold text-xs">
                  <Users className="w-4 h-4 text-scratchly-600" /> Target Audience Segment
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Select audience scope. In the next step, our pre-flight exclusion engine will automatically detect
                  and filter out unsubscribed contacts, hard bounces, invalid syntax, and duplicates.
                </p>

                <div className="pt-2">
                  <label className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-ink-800 border border-scratchly-300 dark:border-scratchly-700 cursor-pointer shadow-subtle">
                    <input type="radio" checked readOnly className="text-scratchly-600" />
                    <div>
                      <div className="text-xs font-bold text-ink-900 dark:text-white">All Active Workspace Contacts</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Evaluates all workspace contacts through compliance & suppression checks.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    playHapticClick();
                    setWizardStep(2);
                  }}
                  className="flex items-center gap-1 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleStep3Next}
                  disabled={wizardLoading}
                  className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
                >
                  {wizardLoading ? 'Analyzing...' : 'Next: Pre-flight Summary'} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Pre-flight Summary & Launch */}
          {wizardStep === 4 && preflightData && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Audience pre-flight analysis completed. Review exclusion breakdown before committing launch.
              </div>

              {/* Preflight Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Selected</span>
                  <span className="text-base font-extrabold text-ink-900 dark:text-white">{preflightData.totalSelected}</span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold">Eligible Recipients</span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">{preflightData.eligibleCount}</span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-bold">Suppressed</span>
                  <span className="text-base font-extrabold text-amber-700 dark:text-amber-300">{preflightData.suppressedCount}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Unsubscribed</span>
                  <span className="text-base font-extrabold text-slate-700 dark:text-slate-300">{preflightData.unsubscribedCount}</span>
                </div>

                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-bold">Invalid Emails</span>
                  <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">{preflightData.invalidEmailCount}</span>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 block font-bold">Duplicates Filtered</span>
                  <span className="text-base font-extrabold text-purple-700 dark:text-purple-300">{preflightData.duplicateCount}</span>
                </div>
              </div>

              {/* Final Sendable Count Banner */}
              <div className="p-4 rounded-2xl bg-scratchly-50 dark:bg-scratchly-950/40 border border-scratchly-200 dark:border-scratchly-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-scratchly-800 dark:text-scratchly-300 font-extrabold uppercase tracking-wider">
                    Final Sendable Recipient Snapshot
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    A persistent CampaignRecipient snapshot will be locked upon launch.
                  </div>
                </div>
                <div className="text-2xl font-black text-scratchly-700 dark:text-scratchly-300 px-4 py-1 bg-white dark:bg-ink-800 rounded-2xl border border-scratchly-200 dark:border-scratchly-700 shadow-subtle">
                  {preflightData.finalSendableCount}
                </div>
              </div>

              {/* Warning if 0 eligible */}
              {preflightData.finalSendableCount === 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Cannot launch campaign: zero eligible recipients found after compliance exclusions.</span>
                </div>
              )}

              {/* Delivery Mode Banner */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                !wizardForm.dryRun
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-scratchly-50 dark:bg-scratchly-950/30 border-scratchly-200 dark:border-scratchly-800 text-scratchly-800 dark:text-scratchly-200'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${!wizardForm.dryRun ? 'bg-emerald-500' : 'bg-scratchly-600'}`} />
                  <div>
                    <div className="text-xs font-bold">
                      {!wizardForm.dryRun ? 'Delivery: Live Outreach' : 'Delivery: Safe Test Run'}
                    </div>
                    <div className="text-[11px] opacity-80 font-medium">
                      {!wizardForm.dryRun
                        ? 'Real emails will be delivered directly to verified candidate inboxes.'
                        : 'Simulated preview recorded safely without contacting candidates.'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playHapticClick();
                    setWizardForm((prev) => ({ ...prev, dryRun: !prev.dryRun, provider: !prev.dryRun ? 'DRY_RUN' : 'SES_BULK' }));
                  }}
                  className="px-3 py-1 text-[11px] font-bold rounded-full bg-white dark:bg-ink-800 hover:bg-slate-50 dark:hover:bg-ink-700 text-ink-900 dark:text-white border border-slate-200 dark:border-slate-700 transition-colors shadow-subtle cursor-pointer"
                >
                  Switch to {!wizardForm.dryRun ? 'Test Run' : 'Live Delivery'}
                </button>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    playHapticClick();
                    setWizardStep(3);
                  }}
                  className="flex items-center gap-1 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={launchLoading || preflightData.finalSendableCount === 0}
                  className={`flex items-center gap-1.5 px-6 py-2 rounded-full text-white text-xs font-bold shadow-sm transition-all disabled:opacity-40 active:scale-95 ${
                    !wizardForm.dryRun
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                      : 'bg-scratchly-600 hover:bg-scratchly-700 hover:shadow-glow-blue'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {launchLoading
                    ? 'Launching Campaign...'
                    : !wizardForm.dryRun
                    ? 'Launch Live Campaign'
                    : 'Run Test Campaign'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Campaign Details Drilldown Modal */}
      <Modal
        isOpen={!!detailCampaign}
        onClose={() => setDetailCampaign(null)}
        title={detailCampaign ? `Campaign: ${detailCampaign.name}` : 'Campaign Details'}
      >
        {detailCampaign && (
          <div className="space-y-5">
            {/* Header KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Status</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border mt-1 ${statusStyles[detailCampaign.status]}`}>
                  {detailCampaign.status.replace('_', ' ')}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Delivered</span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{detailCampaign.deliveredCount}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Recipients</span>
                <span className="text-base font-extrabold text-ink-900 dark:text-white">{detailCampaign.totalRecipients}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Delivery Mode</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-1">
                  {detailCampaign.provider === 'SES_BULK' ? 'Live Outreach' : 'Test Mode'}
                </span>
              </div>
            </div>

            {/* Recipient Statistics Breakdown */}
            {detailCampaign.statusCounts && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-ink-900 dark:text-white block">Recipient State Breakdown:</span>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                    Queued: <strong>{detailCampaign.statusCounts['QUEUED'] || 0}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-scratchly-50 dark:bg-scratchly-950/40 text-scratchly-700 dark:text-scratchly-300 font-semibold">
                    Sending: <strong>{detailCampaign.statusCounts['SENDING'] || 0}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold">
                    Delivered: <strong>{detailCampaign.statusCounts['DELIVERED'] || 0}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold">
                    Failed: <strong>{detailCampaign.statusCounts['FAILED'] || 0}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-ink-800 text-slate-500 dark:text-slate-400 font-semibold">
                    Cancelled: <strong>{detailCampaign.statusCounts['CANCELLED'] || 0}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-extrabold text-ink-900 dark:text-white">Recipient Delivery Snapshot</span>

              <div className="flex items-center gap-2">
                {detailCampaign.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handlePause(detailCampaign.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                )}
                {detailCampaign.status === 'PAUSED' && (
                  <button
                    onClick={() => handleResume(detailCampaign.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold"
                  >
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                )}
                {detailCampaign.status !== 'COMPLETED' && detailCampaign.status !== 'CANCELLED' && (
                  <button
                    onClick={() => setCampaignToCancel(detailCampaign)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel Campaign
                  </button>
                )}
              </div>
            </div>

            {/* Recipient Table Filter & Search */}
            <div className="flex items-center gap-2 text-xs">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter recipient email..."
                  value={recipientsSearch}
                  onChange={(e) => {
                    setRecipientsSearch(e.target.value);
                    loadRecipients(detailCampaign.id, 1, e.target.value, recipientsStatusFilter);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600"
                />
              </div>

              <select
                value={recipientsStatusFilter}
                onChange={(e) => {
                  setRecipientsStatusFilter(e.target.value);
                  loadRecipients(detailCampaign.id, 1, recipientsSearch, e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-scratchly-600"
              >
                <option value="">All Recipient States</option>
                <option value="QUEUED">Queued</option>
                <option value="SENDING">Sending</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Recipient Table */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
              {recipientsLoading ? (
                <div className="p-8 text-center text-slate-500 font-semibold">Loading recipients...</div>
              ) : recipients.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-medium">No recipient records match the filter.</div>
              ) : (
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-ink-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200/80 dark:border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5">Recipient Email</th>
                        <th className="px-4 py-2.5">Personalized Subject</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Delivered At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {recipients.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-ink-700/50">
                          <td className="px-4 py-2.5 font-mono text-[11px] text-ink-900 dark:text-white font-semibold">
                            {r.email}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 truncate max-w-[200px] font-medium" title={r.personalizedSubject}>
                            {r.personalizedSubject}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${recipientStatusBadge(r.status)}`}>
                              {r.status}
                            </span>
                            {r.lastError && (
                              <div className="text-[10px] text-rose-500 truncate max-w-[140px]" title={r.lastError}>
                                {r.lastError}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                            {r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recipient Pagination */}
              {recipientsTotal > 10 && (
                <div className="p-3 bg-slate-50 dark:bg-ink-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>Total: {recipientsTotal} recipients</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const newPage = Math.max(1, recipientsPage - 1);
                        setRecipientsPage(newPage);
                        loadRecipients(detailCampaign.id, newPage, recipientsSearch, recipientsStatusFilter);
                      }}
                      disabled={recipientsPage === 1}
                      className="p-1 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>Page {recipientsPage}</span>
                    <button
                      onClick={() => {
                        const newPage = recipientsPage + 1;
                        setRecipientsPage(newPage);
                        loadRecipients(detailCampaign.id, newPage, recipientsSearch, recipientsStatusFilter);
                      }}
                      disabled={recipientsPage * 10 >= recipientsTotal}
                      className="p-1 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailCampaign(null)}
                className="px-6 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal isOpen={!!campaignToCancel} onClose={() => setCampaignToCancel(null)} title="Cancel Campaign">
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <p className="font-bold text-rose-800 dark:text-rose-200">Confirm Campaign Cancellation</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300 font-medium">
                Are you sure you want to cancel <strong className="text-ink-900 dark:text-white">{campaignToCancel?.name}</strong>?
                Any pending queued jobs will be removed. All previously delivered recipients will remain delivered.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCampaignToCancel(null)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Keep Running
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelLoading}
              className="px-6 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50 active:scale-95"
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel Campaign'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
