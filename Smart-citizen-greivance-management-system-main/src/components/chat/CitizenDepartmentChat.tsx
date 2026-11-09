import React, { useState, useEffect, useRef } from 'react';
import type {
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
  Archive,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  Layers,
} from 'lucide-react';

interface CitizenDepartmentChatProps {
  complaintId: string;
}

export const CitizenDepartmentChat: React.FC<CitizenDepartmentChatProps> = ({
  complaintId,
}) => {
  // Departments state
  const [departments, setDepartments] = useState<ComplaintAssociatedDepartment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(true);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<OfficialComplaintMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Send input state
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Attachments input state
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showAttachInput, setShowAttachInput] = useState<boolean>(false);
  const [attachmentUrlInput, setAttachmentUrlInput] = useState<string>('');

  // Legacy messages state
  const [legacyMessages, setLegacyMessages] = useState<OfficialComplaintMessage[]>([]);
  const [isLegacyOpen, setIsLegacyOpen] = useState<boolean>(false);

  // Auto-scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ─── 1. Load Associated Departments & Legacy Messages ──────────────────────

  const loadDepartments = async () => {
    if (!complaintId) return;
    setIsLoadingDepts(true);
    setDeptError(null);

    try {
      const depts = await fetchComplaintDepartmentsApi(complaintId);
      setDepartments(depts);

      // Auto-select primary or first department if not already selected
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
    loadDepartments();
    loadLegacyMessages();
  }, [complaintId]);

  // ─── 2. Load Messages for Selected Department ──────────────────────────────

  const loadMessages = async (deptId: string) => {
    setIsLoadingMessages(true);
    setMessageError(null);

    try {
      const msgList = await fetchDepartmentMessagesApi(complaintId, deptId);
      // Ensure no internal staff messages leak into citizen view
      const citizenVisible = msgList.filter((m) => !m.isInternal);
      setMessages(citizenVisible);
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
  }, [messages]);

  // ─── 3. Handle Message Submission ──────────────────────────────────────────

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedDeptId || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      const sentMsg = await sendDepartmentMessageApi(complaintId, selectedDeptId, {
        message: inputText.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Clear input and attachments
      setInputText('');
      setAttachments([]);
      setShowAttachInput(false);
      setAttachmentUrlInput('');

      // Append new message or refresh list
      setMessages((prev) => [...prev, sentMsg]);

      // Update message count in departments list
      setDepartments((prev) =>
        prev.map((d) =>
          d.departmentId === selectedDeptId
            ? { ...d, messageCount: (d.messageCount || 0) + 1 }
            : d
        )
      );
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setSendError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachmentUrlInput.trim()) return;
    const url = attachmentUrlInput.trim();
    if (!attachments.includes(url)) {
      setAttachments((prev) => [...prev, url]);
    }
    setAttachmentUrlInput('');
  };

  const handleRemoveAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a !== url));
  };

  const selectedDepartment = departments.find((d) => d.departmentId === selectedDeptId);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Official Department Chat</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified Civic Channel
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct, audited progress discussions with departments assigned to Ticket #{complaintId}
            </p>
          </div>
        </div>

        {selectedDeptId && (
          <button
            type="button"
            onClick={() => loadMessages(selectedDeptId)}
            disabled={isLoadingMessages}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh conversation"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Department Selector Tabs */}
      <div className="px-5 pt-3 pb-2 border-b border-slate-100 bg-slate-50/40">
        {isLoadingDepts ? (
          <div className="flex items-center gap-2 animate-pulse py-1">
            <div className="w-36 h-9 rounded-xl bg-slate-200" />
            <div className="w-36 h-9 rounded-xl bg-slate-200" />
          </div>
        ) : deptError ? (
          <div className="py-2 flex items-center justify-between text-xs text-rose-600 font-medium">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>{deptError}</span>
            </span>
            <button
              onClick={loadDepartments}
              className="text-xs font-bold text-sky-600 underline hover:text-sky-700"
            >
              Retry
            </button>
          </div>
        ) : departments.length === 0 ? (
          <div className="py-2 text-xs text-slate-500 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>
              This grievance has not yet been assigned to a department. Official communication opens upon Central Admin triage.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Departments:
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
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50/50 hover:border-sky-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{dept.departmentName}</span>

                  {dept.isPrimary && (
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
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

      {/* Selected Department Active Sub-Bar */}
      {selectedDepartment && (
        <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900">{selectedDepartment.departmentName}</span>
            {selectedDepartment.code && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-500">
                {selectedDepartment.code}
              </span>
            )}
            {selectedDepartment.reason && (
              <span className="text-slate-500 hidden sm:inline italic">
                — {selectedDepartment.reason}
              </span>
            )}
          </div>

          {selectedDepartment.tasks && selectedDepartment.tasks.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Task: {selectedDepartment.tasks[0].taskId} ({selectedDepartment.tasks[0].status})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Message Stream Container */}
      <div className="p-5 flex-1 min-h-[320px] max-h-[460px] overflow-y-auto space-y-4 bg-slate-50/30">
        {isLoadingMessages ? (
          <div className="space-y-3 py-6 animate-pulse">
            <div className="flex items-start gap-2 max-w-sm">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
              <div className="w-64 h-16 rounded-2xl bg-slate-200" />
            </div>
            <div className="flex items-start gap-2 max-w-sm ml-auto justify-end">
              <div className="w-56 h-12 rounded-2xl bg-sky-200" />
              <div className="w-8 h-8 rounded-full bg-sky-300 flex-shrink-0" />
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
            <p className="text-xs font-medium">Select a department above to view or send messages.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center mx-auto shadow-2xs">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">
                No Messages with {selectedDepartment?.departmentName}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You can ask for work schedule updates, clarify landmarks, or communicate directly with municipal officers assigned to this department.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isCitizen = msg.senderRole === 'citizen';

            return (
              <div
                key={msg._id}
                className={`flex items-start gap-2.5 ${isCitizen ? 'justify-end' : 'justify-start'}`}
              >
                {/* Department Avatar */}
                {!isCitizen && (
                  <div
                    className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-2xs mt-0.5"
                    title={`${msg.senderName} (${msg.senderRole})`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                )}

                {/* Bubble Container */}
                <div
                  className={`max-w-[85%] sm:max-w-md rounded-2xl p-3.5 shadow-2xs text-xs space-y-1.5 ${
                    isCitizen
                      ? 'bg-sky-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  {/* Sender Metadata Bar */}
                  <div
                    className={`flex items-center justify-between gap-2 text-[10px] pb-1 border-b ${
                      isCitizen
                        ? 'border-sky-500/50 text-sky-100'
                        : 'border-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1 truncate">
                      {isCitizen ? (
                        <>
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span>You (Citizen)</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <span className="truncate">{msg.senderName}</span>
                          <span className="opacity-75">
                            • {msg.senderRole.replace('_', ' ')}
                          </span>
                        </>
                      )}
                    </span>

                    <span className="flex-shrink-0 flex items-center gap-0.5 font-mono">
                      <Clock className="w-2.5 h-2.5 opacity-70" />
                      <span>{formatDateTime(msg.createdAt)}</span>
                    </span>
                  </div>

                  {/* Task Reference Tag */}
                  {msg.taskId && (
                    <div
                      className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                        isCitizen
                          ? 'bg-sky-700/60 text-sky-200 border border-sky-500/40'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span>Ref Task #{msg.taskId}</span>
                    </div>
                  )}

                  {/* Message Body */}
                  <p className="whitespace-pre-wrap leading-relaxed text-xs font-normal">
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
                            isCitizen
                              ? 'bg-sky-700/70 text-white border-sky-500 hover:bg-sky-800'
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

                {/* Citizen Avatar */}
                {isCitizen && (
                  <div
                    className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 text-xs font-bold border border-sky-200 mt-0.5"
                    title="You"
                  >
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input & Attachment Bar */}
      {selectedDeptId && (
        <div className="p-4 border-t border-slate-100 bg-white space-y-2">
          {/* Active Attachments Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {attachments.map((url, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg"
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
          {showAttachInput && (
            <form onSubmit={handleAddAttachment} className="flex items-center gap-2 pb-1">
              <input
                type="url"
                value={attachmentUrlInput}
                onChange={(e) => setAttachmentUrlInput(e.target.value)}
                placeholder="Paste photo or document URL (e.g. https://...)"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={!attachmentUrlInput.trim()}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-slate-700 transition"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAttachInput(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Main Input Form */}
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative">
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
                placeholder={`Message ${selectedDepartment?.departmentName || 'department'}... (Press Ctrl+Enter to send)`}
                rows={2}
                disabled={isSending}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
              />
            </div>

            {/* Error Notice */}
            {sendError && (
              <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttachInput((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                    showAttachInput || attachments.length > 0
                      ? 'bg-sky-50 text-sky-700 border-sky-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Attach Photo or Document URL"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Attach URL</span>
                </button>

                <span className="text-[10px] text-slate-400 font-mono">
                  {inputText.length} / 3000
                </span>
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Message</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Legacy / Archived Inquiries Section */}
      {legacyMessages.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setIsLegacyOpen((v) => !v)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition"
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
            <div className="px-5 pb-5 pt-2 space-y-3 border-t border-slate-200/60 bg-white">
              <p className="text-[11px] text-slate-400 italic">
                These historical communications were logged prior to the department-specific messaging system.
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {legacyMessages.map((msg) => (
                  <div
                    key={msg._id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1"
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
