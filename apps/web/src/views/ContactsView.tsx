import React, { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useTheme } from '../context/ThemeContext';
import {
  Users,
  Search,
  Plus,
  Upload,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  ShieldCheck,
  ShieldAlert,
  Ban,
  RotateCcw,
  Sparkles,
  UploadCloud,
  FileText,
  X,
} from 'lucide-react';

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED';
  source: string;
  consentGivenAt: string | null;
  consentProof: string | null;
  externalScratchlyId: string | null;
  isSuppressed?: boolean;
  suppressionReason?: string | null;
  isEligible?: boolean;
  createdAt: string;
}

export const ContactsView: React.FC = () => {
  const { playHapticClick } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'eligible' | 'suppressed'>('all');

  // Add Contact Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: '',
    phone: '',
    consentProof: 'Manual entry with verified recipient opt-in',
  });
  const [addLoading, setAddLoading] = useState(false);

  // Edit Contact Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    company: '',
    phone: '',
    consentProof: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Delete Confirmation Modal
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Suppression / Reason Modal
  const [contactToSuppress, setContactToSuppress] = useState<Contact | null>(null);
  const [suppressReason, setSuppressReason] = useState<'MANUAL' | 'UNSUBSCRIBE' | 'BOUNCE'>('MANUAL');
  const [suppressNotes, setSuppressNotes] = useState('Manually excluded from campaigns');
  const [suppressLoading, setSuppressLoading] = useState(false);

  // CSV Import Modal & Column Mapping
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'upload' | 'paste'>('upload');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: '',
    phone: '',
  });
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  useEffect(() => {
    loadContacts();
  }, [page, statusFilter, eligibilityFilter]);

  const loadContacts = async () => {
    setLoading(true);
    const res = await api.get<Contact[]>('/contacts', {
      page,
      limit,
      search: search || undefined,
      status: statusFilter || undefined,
      eligibility: eligibilityFilter !== 'all' ? eligibilityFilter : undefined,
    });

    if (res.success && res.data) {
      setContacts(res.data);
      if (res.meta) {
        setTotalPages(res.meta.totalPages || 1);
        setTotalCount(res.meta.total || 0);
      }
    }
    setLoading(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playHapticClick();
    setPage(1);
    loadContacts();
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    playHapticClick();
    setAddLoading(true);
    const res = await api.post('/contacts', {
      ...addForm,
      consentGiven: true,
      source: 'manual',
    });
    setAddLoading(false);

    if (res.success) {
      setIsAddOpen(false);
      setAddForm({
        email: '',
        firstName: '',
        lastName: '',
        company: '',
        phone: '',
        consentProof: 'Added directly by team member',
      });
      loadContacts();
    } else {
      alert(res.error || 'Failed to create contact');
    }
  };

  const handleOpenEdit = (contact: Contact) => {
    playHapticClick();
    setEditingContact(contact);
    setEditForm({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      company: contact.company || '',
      phone: contact.phone || '',
      consentProof: contact.consentProof || '',
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    playHapticClick();
    setEditLoading(true);
    const res = await api.put(`/contacts/${editingContact.id}`, editForm);
    setEditLoading(false);

    if (res.success) {
      setIsEditOpen(false);
      setEditingContact(null);
      loadContacts();
    } else {
      alert(res.error || 'Failed to update contact');
    }
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    playHapticClick();
    setDeleteLoading(true);
    const res = await api.del(`/contacts/${contactToDelete.id}`);
    setDeleteLoading(false);

    if (res.success) {
      setContactToDelete(null);
      loadContacts();
    } else {
      alert(res.error || 'Failed to delete contact');
    }
  };

  const handleSuppress = async () => {
    if (!contactToSuppress) return;
    playHapticClick();
    setSuppressLoading(true);
    const res = await api.post(`/contacts/${contactToSuppress.id}/suppress`, {
      reason: suppressReason,
      notes: suppressNotes,
    });
    setSuppressLoading(false);

    if (res.success) {
      setContactToSuppress(null);
      loadContacts();
    } else {
      alert(res.error || 'Failed to suppress contact');
    }
  };

  const handleUnsuppress = async (contact: Contact) => {
    playHapticClick();
    const res = await api.post(`/contacts/${contact.id}/unsuppress`, {});
    if (res.success) {
      loadContacts();
    } else {
      alert(res.error || 'Failed to restore contact');
    }
  };

  // CSV Parsing, Drag & Drop & Column Mapping
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseCsvLine = (line: string, delimiter: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const processCsvContent = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setCsvHeaders([]);
      setCsvRawRows([]);
      return;
    }

    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = parseCsvLine(firstLine, delimiter);
    setCsvHeaders(headers);

    const rawRows = lines.slice(1).map((l) => parseCsvLine(l, delimiter));
    setCsvRawRows(rawRows);

    // Auto-detect columns
    const initialMapping = { email: '', firstName: '', lastName: '', company: '', phone: '' };
    headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes('email') && !initialMapping.email) initialMapping.email = h;
      else if ((lower.includes('first') || lower === 'name') && !initialMapping.firstName) initialMapping.firstName = h;
      else if (lower.includes('last') && !initialMapping.lastName) initialMapping.lastName = h;
      else if (lower.includes('company') && !initialMapping.company) initialMapping.company = h;
      else if (lower.includes('phone') && !initialMapping.phone) initialMapping.phone = h;
    });
    setColumnMapping(initialMapping);
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    processCsvContent(text);
  };

  const processFile = (file: File) => {
    const isCsvOrTxt =
      file.name.endsWith('.csv') ||
      file.name.endsWith('.txt') ||
      file.type === 'text/csv' ||
      file.type === 'text/plain';

    if (!isCsvOrTxt) {
      setDragError('Please select a valid CSV (.csv) or text (.txt) file');
      return;
    }

    setDragError(null);
    setUploadedFile({ name: file.name, size: file.size });

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setCsvText(text);
      processCsvContent(text);
    };
    reader.onerror = () => {
      setDragError('Failed to read file contents. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setCsvText('');
    setCsvHeaders([]);
    setCsvRawRows([]);
    setDragError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const mappedContacts = useMemo(() => {
    if (!columnMapping.email || csvRawRows.length === 0) return [];
    const emailIdx = csvHeaders.indexOf(columnMapping.email);
    const firstIdx = csvHeaders.indexOf(columnMapping.firstName);
    const lastIdx = csvHeaders.indexOf(columnMapping.lastName);
    const compIdx = csvHeaders.indexOf(columnMapping.company);
    const phoneIdx = csvHeaders.indexOf(columnMapping.phone);

    return csvRawRows
      .map((row) => ({
        email: row[emailIdx] || '',
        firstName: firstIdx !== -1 ? row[firstIdx] || undefined : undefined,
        lastName: lastIdx !== -1 ? row[lastIdx] || undefined : undefined,
        company: compIdx !== -1 ? row[compIdx] || undefined : undefined,
        phone: phoneIdx !== -1 ? row[phoneIdx] || undefined : undefined,
        consentGiven: true,
        source: 'csv_import',
      }))
      .filter((c) => c.email && c.email.includes('@'));
  }, [columnMapping, csvHeaders, csvRawRows]);

  const handleRunImport = async () => {
    if (mappedContacts.length === 0) return;
    playHapticClick();
    setImportLoading(true);
    const res = await api.post<{ imported: number; skipped: number }>('/contacts/import', {
      contacts: mappedContacts,
    });
    setImportLoading(false);

    if (res.success && res.data) {
      setImportResult(res.data);
      setTimeout(() => {
        setIsImportOpen(false);
        handleRemoveFile();
        setImportResult(null);
        loadContacts();
      }, 1500);
    } else {
      alert(res.error || 'Import batch failed');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-ink-800 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-full lg:max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600 font-medium"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Eligibility Filter Tabs */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 p-1 text-xs font-bold">
            <button
              onClick={() => {
                playHapticClick();
                setEligibilityFilter('all');
                setPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${
                eligibilityFilter === 'all'
                  ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white shadow-subtle'
                  : 'text-slate-500 hover:text-ink-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => {
                playHapticClick();
                setEligibilityFilter('eligible');
                setPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${
                eligibilityFilter === 'eligible'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-ink-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Eligible
            </button>
            <button
              onClick={() => {
                playHapticClick();
                setEligibilityFilter('suppressed');
                setPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${
                eligibilityFilter === 'suppressed'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-ink-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Suppressed
            </button>
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              playHapticClick();
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
            <option value="BOUNCED">Bounced</option>
            <option value="COMPLAINED">Complained</option>
          </select>

          <button
            onClick={() => {
              playHapticClick();
              setIsImportOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-ink-900 dark:text-white text-xs font-bold transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => {
              playHapticClick();
              setIsAddOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Contacts Table (Tactile Window Aesthetic) */}
      <div className="bg-white dark:bg-ink-800 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-floating overflow-hidden">
        {/* Mockup Window Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-ink-900/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="ml-2 font-mono text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[140px] sm:max-w-none">
              Scratchly Mail › Contacts &amp; Candidates
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-scratchly-700 dark:text-scratchly-300 shrink-0">
            <Sparkles className="w-3 h-3 text-scratchly-600" /> <span className="hidden xs:inline">Preference Guard Active</span>
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">
            <div className="w-6 h-6 rounded-full border-2 border-scratchly-600 border-t-transparent animate-spin mx-auto mb-2"></div>
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Contacts Found"
            description="Your contact directory is currently empty or no contacts matched your active filter. Add contacts individually or import a CSV list."
            actionText="Add First Contact"
            onAction={() => setIsAddOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-slate-50 dark:bg-ink-900 border-b border-slate-200/80 dark:border-slate-800 uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">Contact Name &amp; Email</th>
                  <th className="px-6 py-3.5">Company &amp; Phone</th>
                  <th className="px-6 py-3.5">Outreach Status</th>
                  <th className="px-6 py-3.5">Source &amp; Opt-In</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/80 dark:hover:bg-ink-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-ink-900 dark:text-white">
                        {contact.firstName || contact.lastName
                          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                          : 'Unnamed Contact'}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono mt-0.5">{contact.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-slate-700 dark:text-slate-300 font-semibold">{contact.company || '—'}</div>
                      <div className="text-slate-400 text-[11px] font-medium">{contact.phone || 'No phone'}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {contact.isEligible ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800">
                            <ShieldAlert className="w-3 h-3 text-rose-600" /> Suppressed
                          </span>
                        )}
                        {contact.suppressionReason && (
                          <span className="text-[10px] text-slate-400 font-medium capitalize">
                            Reason: {contact.suppressionReason.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="capitalize">{contact.source.replace('_', ' ')}</span>
                      </div>
                      <div className="text-slate-400 text-[10px] truncate max-w-[180px] mt-0.5" title={contact.consentProof || ''}>
                        {contact.consentProof || 'Verified opt-in'}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(contact)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-600 dark:text-slate-300 hover:text-ink-900 transition-colors"
                          title="Edit Contact"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {contact.isEligible ? (
                          <button
                            onClick={() => {
                              playHapticClick();
                              setContactToSuppress(contact);
                              setSuppressReason('MANUAL');
                              setSuppressNotes('Excluded from outreach by administrator');
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 dark:bg-ink-700 dark:hover:bg-amber-950/40 text-slate-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                            title="Suppress / Exclude"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnsuppress(contact)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 dark:bg-ink-700 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                            title="Restore to Eligible"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            playHapticClick();
                            setContactToDelete(contact);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-ink-700 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalCount > 0 && (
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-ink-900/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <div>
              Showing <span className="font-bold text-ink-900 dark:text-white">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-bold text-ink-900 dark:text-white">{Math.min(page * limit, totalCount)}</span> of{' '}
              <span className="font-bold text-ink-900 dark:text-white">{totalCount}</span> contacts
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  playHapticClick();
                  setPage((p) => Math.max(1, p - 1));
                }}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-ink-900 dark:text-white px-1">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => {
                  playHapticClick();
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Contact">
        <form onSubmit={handleAddContact} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="alex@example.com"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">First Name</label>
              <input
                type="text"
                placeholder="Alex"
                value={addForm.firstName}
                onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Last Name</label>
              <input
                type="text"
                placeholder="Rivera"
                value={addForm.lastName}
                onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Company</label>
              <input
                type="text"
                placeholder="Acme Growth Labs"
                value={addForm.company}
                onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+1 555-0192"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Consent Proof / Opt-in Source</label>
            <input
              type="text"
              value={addForm.consentProof}
              onChange={(e) => setAddForm({ ...addForm, consentProof: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
            >
              {addLoading ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Contact">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={editingContact?.email || ''}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-ink-900/60 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs cursor-not-allowed font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">First Name</label>
              <input
                type="text"
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Last Name</label>
              <input
                type="text"
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Company</label>
              <input
                type="text"
                value={editForm.company}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Consent Proof</label>
            <input
              type="text"
              value={editForm.consentProof}
              onChange={(e) => setEditForm({ ...editForm, consentProof: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
            >
              {editLoading ? 'Saving...' : 'Update Contact'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Suppress Modal */}
      <Modal
        isOpen={!!contactToSuppress}
        onClose={() => setContactToSuppress(null)}
        title="Exclude Contact from Outreach"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Exclude <strong className="text-ink-900 dark:text-white">{contactToSuppress?.email}</strong> from all bulk campaigns.
            This creates an immutable suppression record adhering to CAN-SPAM and GDPR guidelines.
          </p>

          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Suppression Reason</label>
            <select
              value={suppressReason}
              onChange={(e) => setSuppressReason(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-scratchly-600"
            >
              <option value="MANUAL">Manual Exclusion (Administrative)</option>
              <option value="UNSUBSCRIBE">Unsubscribed / Opted-out</option>
              <option value="BOUNCED">Bounced / Bad Mailbox</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Notes / Audit Justification</label>
            <textarea
              rows={2}
              value={suppressNotes}
              onChange={(e) => setSuppressNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setContactToSuppress(null)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSuppress}
              disabled={suppressLoading}
              className="px-6 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
            >
              {suppressLoading ? 'Suppressing...' : 'Confirm Suppression'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!contactToDelete} onClose={() => setContactToDelete(null)} title="Confirm Contact Deletion">
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <p className="font-bold text-rose-800 dark:text-rose-200">Warning: Permanent Action</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300 font-medium">
                Are you sure you want to permanently delete <strong className="text-ink-900 dark:text-white">{contactToDelete?.email}</strong>?
                This will remove their history and past campaign delivery associations.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setContactToDelete(null)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="px-6 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>

      {/* CSV Import Modal with Column Mapping */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          handleRemoveFile();
        }}
        title="Import Contacts via CSV"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Upload a CSV spreadsheet or paste comma-separated values to automatically parse and map contact columns.
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setImportMode('upload')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                importMode === 'upload'
                  ? 'bg-white dark:bg-ink-800 text-scratchly-600 dark:text-scratchly-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" /> Drag & Drop CSV
            </button>
            <button
              type="button"
              onClick={() => setImportMode('paste')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                importMode === 'paste'
                  ? 'bg-white dark:bg-ink-800 text-scratchly-600 dark:text-scratchly-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Paste Raw CSV
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={handleFileSelect}
            className="hidden"
          />

          {importMode === 'upload' ? (
            <div>
              {!uploadedFile ? (
                /* Drag & Drop Area */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
                    isDragging
                      ? 'border-scratchly-500 bg-scratchly-50/70 dark:bg-scratchly-950/50 scale-[1.01]'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-ink-900/60 hover:border-scratchly-400 hover:bg-slate-100/60 dark:hover:bg-ink-900'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 ${
                      isDragging
                        ? 'bg-scratchly-500 text-white shadow-lg shadow-scratchly-500/30'
                        : 'bg-scratchly-50 dark:bg-scratchly-950/60 text-scratchly-600 dark:text-scratchly-400 border border-scratchly-200 dark:border-scratchly-800'
                    }`}
                  >
                    <UploadCloud className="w-6 h-6" />
                  </div>

                  <span className="text-xs font-bold text-ink-900 dark:text-white">
                    {isDragging ? 'Drop your CSV file here' : 'Drag and drop your CSV file here, or click to browse'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Supports standard <code className="text-slate-700 dark:text-slate-300 font-mono">.csv</code> or <code className="text-slate-700 dark:text-slate-300 font-mono">.txt</code> files
                  </span>
                </div>
              ) : (
                /* Uploaded File Chip / Card */
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-ink-900 dark:text-white truncate">
                        {uploadedFile.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>{formatFileSize(uploadedFile.size)}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {csvRawRows.length} rows loaded
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-all"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {dragError && (
                <div className="mt-2 text-xs text-rose-500 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {dragError}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">CSV Content</label>
              <textarea
                rows={4}
                placeholder={`email,firstName,lastName,company,phone\nclaire@example.com,Claire,Dunphy,Pritchett Real Estate,+1 555-0101\nphil@example.com,Phil,Dunphy,Phil's Magic Realty,+1 555-0102`}
                value={csvText}
                onChange={handleCsvChange}
                className="w-full p-3 font-mono text-[11px] rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white focus:outline-none focus:border-scratchly-600"
              />
            </div>
          )}

          {csvHeaders.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-ink-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="text-xs font-bold text-scratchly-700 dark:text-scratchly-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-scratchly-600" /> CSV Column Mapping
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Email Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={columnMapping.email}
                    onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold"
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">First Name Column</label>
                  <select
                    value={columnMapping.firstName}
                    onChange={(e) => setColumnMapping({ ...columnMapping, firstName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold"
                  >
                    <option value="">(None)</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Last Name Column</label>
                  <select
                    value={columnMapping.lastName}
                    onChange={(e) => setColumnMapping({ ...columnMapping, lastName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold"
                  >
                    <option value="">(None)</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Company Column</label>
                  <select
                    value={columnMapping.company}
                    onChange={(e) => setColumnMapping({ ...columnMapping, company: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold"
                  >
                    <option value="">(None)</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone Column</label>
                  <select
                    value={columnMapping.phone}
                    onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-semibold"
                  >
                    <option value="">(None)</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Validation Summary */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Total Parsed Rows: <strong className="text-ink-900 dark:text-white">{csvRawRows.length}</strong>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Valid Email Recipients: {mappedContacts.length}
                </span>
              </div>
            </div>
          )}

          {importResult && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                Successfully imported <strong>{importResult.imported}</strong> contacts!
              </span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setIsImportOpen(false)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-ink-700 dark:hover:bg-ink-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRunImport}
              disabled={mappedContacts.length === 0 || importLoading}
              className="flex items-center gap-2 px-6 py-2 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all disabled:opacity-50 active:scale-95"
            >
              {importLoading ? 'Importing...' : `Import ${mappedContacts.length} Contacts`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
