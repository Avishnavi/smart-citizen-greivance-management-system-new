import React, { useState, useEffect, useRef } from 'react';
import type { DepartmentTask, OfficialComplaintMessage } from '../../types';
import {
  fetchDepartmentMessagesApi,
  sendDepartmentMessageApi,
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
} from 'lucide-react';

interface DepartmentOfficerChatModalProps {
  isOpen: boolean;
  task: DepartmentTask | null;
  onClose: () => void;
  complaintId?: string;
  departmentId?: string;
  departmentName?: string;
}

export const DepartmentOfficerChatModal: React.FC<DepartmentOfficerChatModalProps> = ({
  isOpen,
  task,
  onClose,
  complaintId: propComplaintId,
  departmentId: propDepartmentId,
  departmentName: propDepartmentName,
}) => {
  const { user } = useAuth();

  const complaintId = task?.complaintId || propComplaintId || '';
  const departmentId = task?.departmentId || propDepartmentId || user?.departmentId || '';
  const departmentName = task?.departmentName || propDepartmentName || user?.departmentName || 'Department';

  // Filter & message state
  const [messages, setMessages] = useState<OfficialComplaintMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Auto-scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!complaintId || !departmentId) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const list = await fetchDepartmentMessagesApi(complaintId, departmentId);
      setMessages(list);
    } catch (err: any) {
      console.warn('Failed to load department officer messages:', err);
      setLoadError(err.message || 'Could not load conversation messages.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && complaintId && departmentId) {
      loadMessages();
    }
  }, [isOpen, complaintId, departmentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, filterMode]);

  if (!isOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || !complaintId || !departmentId) return;

    setIsSending(true);
    setSendError(null);

    try {
      const created = await sendDepartmentMessageApi(complaintId, departmentId, {
        message: inputText.trim(),
        isInternal: isInternalMode,
        taskId: task?.taskId || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setInputText('');
      setAttachments([]);
      setShowAttachDrawer(false);
      setAttachmentUrlInput('');
      setMessages((prev) => [...prev, created]);
    } catch (err: any) {
      console.error('Failed to post department message:', err);
      setSendError(err.message || 'Failed to send message. Check authorization.');
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

  // Filtered view
  const visibleMessages = messages.filter((m) => {
    if (filterMode === 'public') return !m.isInternal;
    if (filterMode === 'internal') return m.isInternal;
    return true;
  });

  const internalCount = messages.filter((m) => m.isInternal).length;
  const publicCount = messages.filter((m) => !m.isInternal).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl h-[92vh] max-h-[720px] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-sky-400 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  Department Chat • {departmentName}
                </h2>
                {task?.status && (
                  <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full bg-white/15 text-slate-200">
                    {task.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                Ticket #{complaintId} {task?.taskId ? `• Task #${task.taskId}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadMessages}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition"
              title="Refresh conversation"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
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

        {/* Task Metadata & Filter Pill Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Filter:
            </span>
            <div className="flex items-center gap-1">
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
                <span>Citizen ({publicCount})</span>
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
                <span>Internal Notes ({internalCount})</span>
              </button>
            </div>
          </div>

          {task?.assignedEmployeeName && (
            <div className="text-[11px] text-slate-500">
              Assigned: <span className="font-bold text-slate-800">{task.assignedEmployeeName}</span>
            </div>
          )}
        </div>

        {/* Message Stream */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 bg-slate-50/40">
          {isLoading ? (
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
          ) : loadError ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-rose-600 font-medium">{loadError}</p>
              <button
                type="button"
                onClick={loadMessages}
                className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs"
              >
                Retry
              </button>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900">
                  No Messages in this View
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {filterMode === 'internal'
                    ? 'No internal staff notes recorded yet. Use the toggle below to record confidential observations.'
                    : 'No citizen or official messages recorded yet for this department.'}
                </p>
              </div>
            </div>
          ) : (
            visibleMessages.map((msg) => {
              const isCitizen = msg.senderRole === 'citizen';
              const isInternal = Boolean(msg.isInternal);
              const isSelf = msg.senderId === user?.id;

              return (
                <div
                  key={msg._id}
                  className={`flex items-start gap-2.5 ${
                    isInternal
                      ? 'justify-center'
                      : isCitizen
                        ? 'justify-start'
                        : 'justify-end'
                  }`}
                >
                  {/* Left Avatar for Citizen */}
                  {isCitizen && (
                    <div
                      className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 text-xs font-bold border border-sky-200 mt-0.5"
                      title={msg.senderName}
                    >
                      <User className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] sm:max-w-md rounded-2xl p-3.5 shadow-2xs text-xs space-y-1.5 ${
                      isInternal
                        ? 'w-full max-w-lg bg-amber-50/90 border-2 border-amber-300 text-amber-950 rounded-2xl shadow-xs'
                        : isCitizen
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                          : 'bg-slate-900 text-white rounded-tr-xs'
                    }`}
                  >
                    {/* Header bar */}
                    <div
                      className={`flex items-center justify-between gap-2 text-[10px] pb-1 border-b ${
                        isInternal
                          ? 'border-amber-200 text-amber-900'
                          : isCitizen
                            ? 'border-slate-100 text-slate-500'
                            : 'border-slate-700 text-slate-300'
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
                        ) : isCitizen ? (
                          <>
                            <User className="w-3 h-3 text-sky-600 flex-shrink-0" />
                            <span className="truncate">{msg.senderName}</span>
                            <span className="opacity-75">• Citizen</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <span className="truncate">
                              {msg.senderName} {isSelf ? '(You)' : ''}
                            </span>
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

                    {/* Notice for Internal Notes */}
                    {isInternal && (
                      <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <span>Staff Eyes Only • Hidden from Citizen</span>
                      </div>
                    )}

                    {/* Task Reference */}
                    {msg.taskId && (
                      <div
                        className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          isInternal
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isCitizen
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
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
                                : isCitizen
                                  ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">
                              Proof Attachment {idx + 1}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Avatar for Staff */}
                  {!isCitizen && !isInternal && (
                    <div
                      className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-2xs mt-0.5"
                      title={msg.senderName}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply & Internal Note Composer */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-3">
          {/* Message Mode Selector */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setIsInternalMode(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  !isInternalMode
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>Public Reply to Citizen</span>
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
                <span>Internal Staff Note</span>
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              {isInternalMode ? 'Staff Eyes Only' : 'Citizen Visible'}
            </span>
          </div>

          {/* Attachments Chips */}
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
                placeholder="Paste proof photo or document URL (https://...)"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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

          {/* Input Textarea Form */}
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
                  ? 'Record confidential site inspection notes, contractor delays, or staff memo...'
                  : 'Write official response to citizen (e.g. Work is scheduled tomorrow at 10 AM)...'
              }
              rows={2}
              disabled={isSending}
              className={`w-full px-3.5 py-2.5 border rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 resize-none transition ${
                isInternalMode
                  ? 'bg-amber-50/50 border-amber-300 text-amber-950 focus:bg-white focus:ring-amber-500/20 focus:border-amber-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:ring-sky-500/20 focus:border-sky-500'
              }`}
            />

            {/* Error Message */}
            {sendError && (
              <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttachDrawer((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                    showAttachDrawer || attachments.length > 0
                      ? 'bg-sky-50 text-sky-700 border-sky-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Attach Proof</span>
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
                    : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                }`}
              >
                {isSending ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : isInternalMode ? (
                  <>
                    <span>Post Internal Note</span>
                    <Lock className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Send Official Reply</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

