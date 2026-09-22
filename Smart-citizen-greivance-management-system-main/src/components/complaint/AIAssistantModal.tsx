import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Check, RefreshCw } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { getAssistantResponse } from '../../services/aiService';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDescription: (refinedDescription: string) => void;
  initialText?: string;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplyDescription,
  initialText = ''
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: 'Hello! I am your Smart City AI Grievance Assistant 🤖. How can I help you formulate a clear civic complaint for the municipal corporation today?',
      options: [
        'Water on street',
        'Large pothole on road',
        'Streetlights not working',
        'Garbage bin overflowing'
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [latestRefinedText, setLatestRefinedText] = useState<string>(initialText);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputVal.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputVal('');
    setIsLoading(true);

    try {
      const response = await getAssistantResponse(newHistory, text);

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.message,
        options: response.suggestedOptions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (response.refinedDescription) {
        setLatestRefinedText(response.refinedDescription);
      } else {
        setLatestRefinedText(text);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    onApplyDescription(latestRefinedText || messages[messages.length - 1]?.text || '');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col h-[580px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-sky-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm">Civic Complaint Assistant</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 rounded uppercase">
                  AI Guidance
                </span>
              </div>
              <p className="text-[11px] text-sky-100">
                Helps structure clean, actionable problem details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat History Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
          <div className="p-2.5 bg-amber-50 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> This assistant helps describe your problem clearly. Final classification & priority will be evaluated during the AI Analysis step.
            </span>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-xs'
                }`}
              >
                <p>{msg.text}</p>
                <span
                  className={`block text-[10px] mt-1 text-right ${
                    msg.sender === 'user' ? 'text-sky-100' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* Quick Reply Suggestion Chips */}
              {msg.options && msg.options.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                  {msg.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(opt)}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-white hover:bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold rounded-xl shadow-xs transition hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
              <span>Assistant is formulating guidance...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Refined Text Preview Bar if available */}
        {latestRefinedText && (
          <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 truncate">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold truncate">Draft ready:</span>
              <span className="truncate text-emerald-700 italic">"{latestRefinedText}"</span>
            </div>
            <button
              onClick={handleApply}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition whitespace-nowrap shadow-xs"
            >
              Use This
            </button>
          </div>
        )}

        {/* Input Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your civic issue (e.g. water leak on street)..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputVal.trim() || isLoading}
            className="p-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
