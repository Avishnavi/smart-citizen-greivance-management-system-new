import React, { useState, useEffect, useRef } from 'react';
import type {
  Complaint,
  ComplaintAssociatedDepartment,
  OfficialComplaintMessage,
} from '../../types';
import {
  fetchComplaintDepartmentsApi,
  fetchDepartmentMessagesApi,
  sendDepartmentMessageApi,
  fetchLegacyMessagesApi,
} from '../../services/complaintService';
import { formatDateTime } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import {
  MessageSquare,
  Send,
  Building2,
  Paperclip,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  User,
  ExternalLink,
  Lock,
  Eye,
  X,
  Clock,
  Layers,
  Filter,
  Shield,
  Archive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AdminOfficialChatModalProps {
  isOpen: boolean;
  complaint: Complaint | null;
  onClose: () => void;
}

export const AdminOfficialChatModal: React.FC<AdminOfficialChatModalProps> = ({
  isOpen,
  complaint,
  onClose,
}) => {
  const { user } = useAuth();
  const complaintId = complaint?.id || '';

  // Departments state
  const [departments, setDepartments] = useState<ComplaintAssociatedDepartment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(true);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<OfficialComplaintMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'public' | 'internal'>('all');

  // Send input state
  const [isInternalMode, setIsInternalMode] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showAttachDrawer, setShowAttachDrawer] = useState<boolean>(false);
  const [attachmentUrlInput, setAttachmentUrlInput] = useState<string>('');

  // Legacy messages state
  const [legacyMessages, setLegacyMessages] = useState<OfficialComplaintMessage[]>([]);
  const [isLegacyOpen, setIsLegacyOpen] = useState<boolean>(false);

  // Auto-scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ─── 1. Load Departments & Legacy Messages ───────────────────────────────────

  const loadDepartments = async () => {
    if (!complaintId) return;
    setIsLoadingDepts(true);
    setDeptError(null);

    try {
      const depts = await fetchComplaintDepartmentsApi(complaintId);
      setDepartments(depts);

      if (depts.length > 0) {
        const primary = depts.find((d) => d.isPrimary) || depts[0];
        setSelectedDeptId((prev) => (prev && depts.some((d) => d.departmentId === prev) ? prev : primary.departmentId));
      } else {
        setSelectedDeptId(null);
      }
    } catch (err: any) {
      console.warn('Failed to load complaint departments:', err);
      setDeptError(err.message || 'Could not load assigned municipal departments.');
    } finally {
      setIsLoadingDepts(false);
    }
  };

  const loadLegacyMessages = async () => {
    if (!complaintId) return;
    try {
      const leg = await fetchLegacyMessagesApi(complaintId);
      setLegacyMessages(leg);
    } catch (err) {
      console.warn('Failed to load legacy messages:', err);
    }
  };

  useEffect(() => {
    if (isOpen && complaintId) {
      loadDepartments();
      loadLegacyMessages();
    }
  }, [isOpen, complaintId]);

  // ─── 2. Load Messages for Selected Department ────────────────────────────────

  const loadMessages = async (deptId: string) => {
    setIsLoadingMessages(true);
    setMessageError(null);

    try {
      // Central Admin can see all messages (public + internal)
      const list = await fetchDepartmentMessagesApi(complaintId, deptId);
      setMessages(list);
    } catch (err: any) {
      console.warn('Failed to load department messages:', err);
      setMessageError(err.message || 'Failed to retrieve conversation messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedDeptId) {
      loadMessages(selectedDeptId);
    } else {
      setMessages([]);
    }
  }, [selectedDeptId, complaintId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, filterMode]);

  if (!isOpen || !complaint) return null;

  // ─── 3. Message Submission Handler ──────────────────────────────────────────

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || !complaintId || !selectedDeptId) return;

    setIsSending(true);
    setSendError(null);

    try {
      const selectedDept = departments.find((d) => d.departmentId === selectedDeptId);
      const activeTaskId = selectedDept?.tasks?.[0]?.taskId || undefined;

      const created = await sendDepartmentMessageApi(complaintId, selectedDeptId, {
        message: inputText.trim(),
        isInternal: isInternalMode,
        taskId: activeTaskId,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setInputText('');
      setAttachments([]);
      setShowAttachDrawer(false);
      setAttachmentUrlInput('');
      setMessages((prev) => [...prev, created]);

      // Update message count badge on current department tab
      setDepartments((prev) =>
        prev.map((d) =>
          d.departmentId === selectedDeptId
            ? { ...d, messageCount: (d.messageCount || 0) + 1 }
            : d
        )
      );
    } catch (err: any) {
      console.error('Failed to post admin message:', err);
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    const url = attachmentUrlInput.trim();
    if (url && !attachments.includes(url)) {
      setAttachments((prev) => [...prev, url]);
      setAttachmentUrlInput('');
    }
  };

  const handleRemoveAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a !== url));
  };

  const selectedDepartment = departments.find((d) => d.departmentId === selectedDeptId);

  // Filtered message view
  const visibleMessages = messages.filter((m) => {
    if (filterMode === 'public') return !m.isInternal;
    if (filterMode === 'internal') return m.isInternal;
    return true;
  });

  const internalCount = messages.filter((m) => m.isInternal).length;
  const publicCount = messages.filter((m) => !m.isInternal).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl h-[94vh] max-h-[760px] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 flex items-center justify-center flex-shrink-0 shadow-xs">
              <Shield className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  Central Admin Oversight • Ticket #{complaint.id}
                </h2>
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full bg-white/15 text-slate-200">
                  {complaint.status}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Citywide Oversight
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                {complaint.description || complaint.category} • Ward: {complaint.location?.ward || 'Ward 102'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedDeptId && (
              <button
                type="button"
                onClick={() => loadMessages(selectedDeptId)}
                disabled={isLoadingMessages}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition"
                title="Refresh conversation"
              >
                <RotateCcw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Participating Department Selector Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 bg-slate-50/70">
          {isLoadingDepts ? (
            <div className="flex items-center gap-2 animate-pulse py-1">
              <div className="w-40 h-9 rounded-xl bg-slate-200" />
              <div className="w-40 h-9 rounded-xl bg-slate-200" />
            </div>
          ) : deptError ? (
            <div className="py-2 flex items-center justify-between text-xs text-rose-600 font-medium">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>{deptError}</span>
              </span>
              <button
                onClick={loadDepartments}
                className="text-xs font-bold text-indigo-600 underline hover:text-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : departments.length === 0 ? (
            <div className="py-2 text-xs text-slate-500 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>
                No municipal departments have been assigned to this grievance yet. Assign departments via Routing Approval.
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Participating Departments:
              </span>
              {departments.map((dept) => {
                const isSelected = dept.departmentId === selectedDeptId;
                return (
                  <button
                    key={dept.departmentId}
                    type="button"
                    onClick={() => setSelectedDeptId(dept.departmentId)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-300'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{dept.departmentName}</span>

                    {dept.isPrimary && (
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        Primary
                      </span>
                    )}

                    {typeof dept.messageCount === 'number' && dept.messageCount > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {dept.messageCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Department Active Sub-Bar & Filter Pills */}
        <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {selectedDepartment ? (
              <div className="flex items-center gap-2 truncate">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-bold text-slate-900 truncate">
                  {selectedDepartment.departmentName}
                </span>
                {selectedDepartment.code && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-500">
                    {selectedDepartment.code}
                  </span>
                )}
                {selectedDepartment.tasks && selectedDepartment.tasks.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                    (Task #{selectedDepartment.tasks[0].taskId} • {selectedDepartment.tasks[0].status})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 italic">No department selected</span>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({messages.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('public')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                filterMode === 'public'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Public ({publicCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('internal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                filterMode === 'internal'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <Lock className="w-3 h-3 text-amber-500" />
              <span>Internal ({internalCount})</span>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 bg-slate-50/40">
          {isLoadingMessages ? (
            <div className="space-y-3 py-6 animate-pulse">
              <div className="flex items-start gap-2 max-w-sm">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="w-64 h-16 rounded-2xl bg-slate-200" />
              </div>
              <div className="flex items-start gap-2 max-w-sm ml-auto justify-end">
                <div className="w-56 h-12 rounded-2xl bg-indigo-200" />
                <div className="w-8 h-8 rounded-full bg-indigo-300 flex-shrink-0" />
              </div>
            </div>
          ) : messageError ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-rose-600 font-medium">{messageError}</p>
              {selectedDeptId && (
                <button
                  type="button"
                  onClick={() => loadMessages(selectedDeptId)}
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs"
                >
                  Retry
                </button>
              )}
            </div>
          ) : !selectedDeptId ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Building2 className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium">Select a department above to inspect official discussions.</p>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900">
                  No Messages with {selectedDepartment?.departmentName}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {filterMode === 'internal'
                    ? 'No internal directives or staff notes recorded yet for this department.'
                    : 'No public citizen discussions recorded yet. Use the composer below to issue administrative directives or official public updates.'}
                </p>
              </div>
            </div>
          ) : (
            visibleMessages.map((msg) => {
              const isCitizen = msg.senderRole === 'citizen';
              const isAdmin = msg.senderRole === 'central_admin';
              const isInternal = Boolean(msg.isInternal);
              const isSelf = msg.senderId === user?.id;

              return (
                <div
                  key={msg._id}
                  className={`flex items-start gap-2.5 ${
                    isInternal
                      ? 'justify-center'
                      : isAdmin
                        ? 'justify-end'
                        : isCitizen
                          ? 'justify-start'
                          : 'justify-start'
                  }`}
                >
                  {/* Left Avatar for Citizen or Department Officer */}
                  {!isAdmin && !isInternal && (
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-2xs mt-0.5 ${
                        isCitizen
                          ? 'bg-sky-100 text-sky-700 border border-sky-200'
                          : 'bg-slate-900 text-white'
                      }`}
                      title={`${msg.senderName} (${msg.senderRole})`}
                    >
                      {isCitizen ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] sm:max-w-md rounded-2xl p-3.5 shadow-2xs text-xs space-y-1.5 ${
                      isInternal
                        ? 'w-full max-w-lg bg-amber-50/95 border-2 border-amber-300 text-amber-950 rounded-2xl shadow-xs'
                        : isAdmin
                          ? 'bg-indigo-900 text-white rounded-tr-xs'
                          : isCitizen
                            ? 'bg-sky-50/70 border border-sky-200 text-slate-900 rounded-tl-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {/* Header Bar */}
                    <div
                      className={`flex items-center justify-between gap-2 text-[10px] pb-1 border-b ${
                        isInternal
                          ? 'border-amber-200 text-amber-900'
                          : isAdmin
                            ? 'border-indigo-700 text-indigo-200'
                            : isCitizen
                              ? 'border-sky-200 text-sky-800'
                              : 'border-slate-100 text-slate-500'
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1 truncate">
                        {isInternal ? (
                          <>
                            <Lock className="w-3 h-3 text-amber-700 flex-shrink-0" />
                            <span>INTERNAL NOTE</span>
                            <span className="opacity-75">
                              • {msg.senderName} ({msg.senderRole.replace('_', ' ')})
                            </span>
                          </>
                        ) : isAdmin ? (
                          <>
                            <Shield className="w-3 h-3 text-indigo-300 flex-shrink-0" />
                            <span className="truncate">
                              {msg.senderName} {isSelf ? '(You)' : ''}
                            </span>
                            <span className="opacity-75">• Central Admin</span>
                          </>
                        ) : isCitizen ? (
                          <>
                            <User className="w-3 h-3 text-sky-600 flex-shrink-0" />
                            <span className="truncate">{msg.senderName}</span>
                            <span className="opacity-75">• Citizen</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-3 h-3 text-slate-600 flex-shrink-0" />
                            <span className="truncate">{msg.senderName}</span>
                            <span className="opacity-75">
                              • {msg.senderRole.replace('_', ' ')} ({msg.departmentName || 'Dept'})
                            </span>
                          </>
                        )}
                      </span>

                      <span className="flex-shrink-0 flex items-center gap-0.5 font-mono">
                        <Clock className="w-2.5 h-2.5 opacity-70" />
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </span>
                    </div>

                    {/* Notice for Internal Notes */}
                    {isInternal && (
                      <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <span>Staff & Admin Eyes Only • Hidden from Citizen</span>
                      </div>
                    )}

                    {/* Task Reference */}
                    {msg.taskId && (
                      <div
                        className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          isInternal
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isAdmin
                              ? 'bg-indigo-800 text-indigo-200 border border-indigo-700'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Layers className="w-2.5 h-2.5" />
                        <span>Ref Task #{msg.taskId}</span>
                      </div>
                    )}

                    {/* Message Body */}
                    <p className="whitespace-pre-wrap leading-relaxed text-xs">
                      {msg.message}
                    </p>

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        {msg.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                              isInternal
                                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                : isAdmin
                                  ? 'bg-indigo-800 text-white border-indigo-700 hover:bg-indigo-700'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">
                              Attachment {idx + 1}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Avatar for Admin */}
                  {isAdmin && !isInternal && (
                    <div
                      className="w-8 h-8 rounded-xl bg-indigo-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-2xs mt-0.5"
                      title="You (Central Admin)"
                    >
                      <Shield className="w-4 h-4 text-indigo-300" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Admin Message & Directive Composer */}
        {selectedDeptId && (
          <div className="p-4 border-t border-slate-200 bg-white space-y-3">
            {/* Mode Switcher: Public Broadcast vs Internal Directive */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsInternalMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    !isInternalMode
                      ? 'bg-white text-indigo-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Public Official Notice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternalMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isInternalMode
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Administrative Directive (Staff Eyes Only)</span>
                </button>
              </div>

              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                {isInternalMode ? 'Hidden from Citizen' : 'Citizen Visible'}
              </span>
            </div>

            {/* Active Attachment Chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {attachments.map((url, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span className="truncate max-w-[180px]">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(url)}
                      className="hover:text-rose-600 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Attachment URL Input Drawer */}
            {showAttachDrawer && (
              <form onSubmit={handleAddAttachment} className="flex items-center gap-2 pb-1">
                <input
                  type="url"
                  value={attachmentUrlInput}
                  onChange={(e) => setAttachmentUrlInput(e.target.value)}
                  placeholder="Paste document or photo URL (https://...)"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!attachmentUrlInput.trim()}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAttachDrawer(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="space-y-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                maxLength={3000}
                placeholder={
                  isInternalMode
                    ? `Issue administrative directive to ${selectedDepartment?.departmentName} supervisor... (Press Ctrl+Enter)`
                    : `Broadcast public administrative message to citizen regarding ${selectedDepartment?.departmentName}... (Press Ctrl+Enter)`
                }
                rows={2}
                disabled={isSending}
                className={`w-full px-3.5 py-2.5 border rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 resize-none transition ${
                  isInternalMode
                    ? 'bg-amber-50/50 border-amber-300 text-amber-950 focus:bg-white focus:ring-amber-500/20 focus:border-amber-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />

              {sendError && (
                <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{sendError}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAttachDrawer((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                      showAttachDrawer || attachments.length > 0
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Attach Link</span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {inputText.length} / 3000
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                    isInternalMode
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                  }`}
                >
                  {isSending ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transmitting...</span>
                    </>
                  ) : isInternalMode ? (
                    <>
                      <span>Issue Directive</span>
                      <Lock className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Broadcast Notice</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Legacy / Archived Inquiries Drawer */}
        {legacyMessages.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setIsLegacyOpen((v) => !v)}
              className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition"
            >
              <span className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-slate-500" />
                <span>Archived / General Inquiries ({legacyMessages.length})</span>
              </span>
              <span className="text-slate-400">
                {isLegacyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {isLegacyOpen && (
              <div className="px-5 pb-4 pt-2 space-y-2 border-t border-slate-200/60 bg-white max-h-40 overflow-y-auto">
                {legacyMessages.map((msg) => (
                  <div
                    key={msg._id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-bold text-slate-700">
                        {msg.senderName} ({msg.senderRole.replace('_', ' ')})
                      </span>
                      <span>{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-slate-800">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

