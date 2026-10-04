import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useTheme } from '../context/ThemeContext';
import {
  FileText,
  Plus,
  Eye,
  Trash2,
  Edit2,
  Copy,
  Sparkles,
  AlertCircle,
  Tag,
  Check,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  previewText: string | null;
  _count?: { campaigns: number };
  createdAt: string;
}

export const TemplatesView: React.FC = () => {
  const { playHapticClick } = useTheme();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    previewText: '',
    bodyHtml: '',
    bodyText: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete Confirmation Modal
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Live Interactive Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activePreview, setActivePreview] = useState<{
    subject: string;
    html: string;
    text: string | null;
  } | null>(null);

  const [testVariables, setTestVariables] = useState({
    first_name: 'Devin',
    last_name: 'Torres',
    email: 'devin@partnerlabs.io',
    company: 'PartnerLabs Global',
  });

  const [activeTargetField, setActiveTargetField] = useState<'subject' | 'bodyHtml' | 'bodyText'>('bodyHtml');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const res = await api.get<Template[]>('/templates');
    if (res.success && res.data) {
      setTemplates(res.data);
    }
    setLoading(false);
  };

  const handleOpenCreate = () => {
    playHapticClick();
    setEditingId(null);
    setForm({
      name: '',
      subject: '',
      previewText: '',
      bodyHtml: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
  <p>Hi {{first_name}},</p>
  <p>I came across your profile and was really impressed by your background at {{company}}.</p>
  <p>We are expanding our team and I'd love to connect briefly this week to share more details about exciting opportunities with us.</p>
  <p>Best regards,<br/>The Recruiting Team</p>
</div>`,
      bodyText: 'Hi {{first_name}},\n\nI came across your profile and was really impressed by your background at {{company}}.\n\nWe are expanding our team and I\'d love to connect briefly this week to share more details about exciting opportunities with us.\n\nBest regards,\nThe Recruiting Team',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Template) => {
    playHapticClick();
    setEditingId(t.id);
    setForm({
      name: t.name,
      subject: t.subject,
      previewText: t.previewText || '',
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText || '',
    });
    setIsModalOpen(true);
  };

  const handleInsertVariable = (variableName: string) => {
    playHapticClick();
    const token = `{{${variableName}}}`;
    setForm((prev) => ({
      ...prev,
      [activeTargetField]: prev[activeTargetField] + token,
    }));
    setCopiedVariable(token);
    setTimeout(() => setCopiedVariable(null), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playHapticClick();
    setSaving(true);

    let res;
    if (editingId) {
      res = await api.put(`/templates/${editingId}`, form);
    } else {
      res = await api.post('/templates', form);
    }
    setSaving(false);

    if (res.success) {
      setIsModalOpen(false);
      loadTemplates();
    } else {
      alert(res.error || 'Failed to save template');
    }
  };

  const handleDuplicate = async (id: string) => {
    playHapticClick();
    const res = await api.post<Template>(`/templates/${id}/duplicate`, {});
    if (res.success) {
      loadTemplates();
    } else {
      alert(res.error || 'Failed to duplicate template');
    }
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    playHapticClick();
    setDeleteLoading(true);
    const res = await api.del(`/templates/${templateToDelete.id}`);
    setDeleteLoading(false);

    if (res.success) {
      setTemplateToDelete(null);
      loadTemplates();
    } else {
      alert(res.error || 'Failed to delete template');
    }
  };

  const handleRenderPreview = async (t?: Template) => {
    playHapticClick();
    const subject = t ? t.subject : form.subject;
    const bodyHtml = t ? t.bodyHtml : form.bodyHtml;
    const bodyText = t ? t.bodyText : form.bodyText;

    const res = await api.post<{ subject: string; html: string; text: string | null }>(
      '/templates/preview/render',
      {
        subject,
        bodyHtml,
        bodyText,
        sampleData: testVariables,
      }
    );

    if (res.success && res.data) {
      setActivePreview(res.data);
      setIsPreviewOpen(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white dark:bg-ink-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h3 className="font-extrabold text-ink-900 dark:text-white text-base">Email Templates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Design reusable outreach messages with candidate personalization fields
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all active:scale-95 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Create Template
        </button>
      </div>

      {/* Grid of Templates */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-subtle">
          <EmptyState
            icon={FileText}
            title="No Templates Created Yet"
            description="Create your first reusable email template with candidate fields for personalized outreach."
            actionText="Create First Template"
            onAction={handleOpenCreate}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white dark:bg-ink-800 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 flex flex-col justify-between hover:border-scratchly-300 dark:hover:border-slate-700 shadow-subtle hover:shadow-card transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-950/60 dark:text-scratchly-300 border border-scratchly-200/80 dark:border-scratchly-800 flex items-center justify-center font-bold shadow-subtle">
                      <FileText className="w-5 h-5 text-scratchly-600" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-ink-900 dark:text-white text-sm group-hover:text-scratchly-600 transition-colors">
                        {tpl.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {tpl._count?.campaigns || 0} campaigns used
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold bg-slate-50 dark:bg-ink-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 mb-3 truncate">
                  <span className="text-slate-400 mr-1.5 font-bold">Subject:</span>
                  {tpl.subject}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-3 bg-slate-50/70 dark:bg-ink-900/60 p-3 rounded-2xl font-mono border border-slate-200/60 dark:border-slate-800">
                  {tpl.bodyText || tpl.bodyHtml.replace(/<[^>]*>?/gm, '')}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleRenderPreview(tpl)}
                  className="flex items-center gap-1.5 text-xs text-scratchly-600 dark:text-scratchly-400 hover:text-scratchly-700 font-bold transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDuplicate(tpl.id)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-600 dark:text-slate-300 hover:text-ink-900 transition-colors"
                    title="Duplicate Template"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenEdit(tpl)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-600 dark:text-slate-300 hover:text-ink-900 transition-colors"
                    title="Edit Template"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      playHapticClick();
                      setTemplateToDelete(tpl);
                    }}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-ink-700 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                    title="Delete Template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Template Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Email Template' : 'Create Email Template'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">
              Template Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 Executive Outreach"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">
              Subject Line <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Quick question regarding {{company}}"
              value={form.subject}
              onFocus={() => setActiveTargetField('subject')}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          {/* Quick Variable Insertion Pills */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-medium">
              <span className="flex items-center gap-1 font-bold text-scratchly-700 dark:text-scratchly-400">
                <Tag className="w-3 h-3 text-scratchly-600" /> Insert Personalization Tag:
              </span>
              <span className="text-slate-400">Inserting into: {activeTargetField}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'first_name', desc: 'Recipient First Name' },
                { label: 'last_name', desc: 'Recipient Last Name' },
                { label: 'company', desc: 'Recipient Company' },
                { label: 'email', desc: 'Recipient Email' },
              ].map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => handleInsertVariable(v.label)}
                  className="px-3 py-1 rounded-full bg-scratchly-50 hover:bg-scratchly-100 dark:bg-scratchly-950/60 dark:hover:bg-scratchly-900/60 border border-scratchly-200 dark:border-scratchly-800 text-scratchly-700 dark:text-scratchly-300 text-[11px] font-mono font-bold flex items-center gap-1 transition-all active:scale-95"
                  title={v.desc}
                >
                  <span>{`{{${v.label}}}`}</span>
                  {copiedVariable === `{{${v.label}}}` && <Check className="w-3 h-3 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">
              HTML Body Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={6}
              value={form.bodyHtml}
              onFocus={() => setActiveTargetField('bodyHtml')}
              onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
              className="w-full p-3 font-mono text-xs rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white focus:outline-none focus:border-scratchly-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Plain-text Fallback Body</label>
            <textarea
              rows={3}
              value={form.bodyText}
              onFocus={() => setActiveTargetField('bodyText')}
              onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
              className="w-full p-3 font-mono text-xs rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white focus:outline-none focus:border-scratchly-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleRenderPreview()}
              className="flex items-center gap-1 text-xs text-scratchly-600 dark:text-scratchly-400 hover:text-scratchly-700 font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" /> Test Render
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
              >
                {saving ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!templateToDelete} onClose={() => setTemplateToDelete(null)} title="Delete Template">
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <p className="font-bold text-rose-800 dark:text-rose-200">Delete Template Confirmation</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300 font-medium">
                Are you sure you want to delete <strong className="text-ink-900 dark:text-white">{templateToDelete?.name}</strong>?
                Existing campaigns using this template will preserve their sent content snapshot.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setTemplateToDelete(null)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="px-6 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50 active:scale-95"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Live Preview Modal */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title="Personalization Preview">
        <div className="space-y-4">
          {/* Sample Variables Controls */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
            <span className="font-bold text-scratchly-700 dark:text-scratchly-300 block text-[11px]">Preview Contact Data:</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">First Name</label>
                <input
                  type="text"
                  value={testVariables.first_name}
                  onChange={(e) => setTestVariables({ ...testVariables, first_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-xs font-medium border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Last Name</label>
                <input
                  type="text"
                  value={testVariables.last_name}
                  onChange={(e) => setTestVariables({ ...testVariables, last_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-xs font-medium border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Company</label>
                <input
                  type="text"
                  value={testVariables.company}
                  onChange={(e) => setTestVariables({ ...testVariables, company: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-xs font-medium border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Email</label>
                <input
                  type="text"
                  value={testVariables.email}
                  onChange={(e) => setTestVariables({ ...testVariables, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-xs font-medium border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          {activePreview && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 text-xs">
                <span className="text-slate-400 font-bold block text-[11px] mb-0.5">Rendered Subject:</span>
                <span className="text-ink-900 dark:text-white font-extrabold text-sm">{activePreview.subject}</span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[11px] mb-1">Rendered HTML Output:</span>
                <div
                  className="p-4 rounded-2xl bg-white text-slate-900 text-xs min-h-[160px] border border-slate-200 shadow-sm overflow-auto"
                  dangerouslySetInnerHTML={{ __html: activePreview.html }}
                />
              </div>

              {activePreview.text && (
                <div>
                  <span className="text-slate-400 font-bold block text-[11px] mb-1">Plain-text Output:</span>
                  <pre className="p-3 rounded-2xl bg-slate-50 dark:bg-ink-900 font-mono text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap">
                    {activePreview.text}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm"
            >
              Close Preview
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
