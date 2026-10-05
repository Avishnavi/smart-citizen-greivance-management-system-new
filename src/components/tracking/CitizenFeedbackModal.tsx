import React, { useState } from 'react';
import { Star, X, Send } from 'lucide-react';
import type { CitizenFeedback } from '../../types';

interface CitizenFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaintId: string;
  onSubmitFeedback: (feedback: CitizenFeedback) => void;
}

export const CitizenFeedbackModal: React.FC<CitizenFeedbackModalProps> = ({
  isOpen,
  onClose,
  complaintId,
  onSubmitFeedback
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Fast Turnaround', 'Clean Work']);

  if (!isOpen) return null;

  const availableTags = [
    'Fast Turnaround',
    'Clean Work',
    'Polite Field Staff',
    'Satisfied with Quality',
    'Followed SLA Timelines',
    'Average Work',
    'Needs Improvement'
  ];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitFeedback({
      rating,
      comment: comment.trim(),
      tags: selectedTags,
      submittedAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Star className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Citizen Service Feedback</h3>
              <p className="text-[11px] text-amber-100 font-mono">
                Complaint: {complaintId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-center">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              How satisfied are you with the municipal resolution?
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 text-slate-300 hover:scale-125 transition duration-150 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 ${
                      (hoverRating || rating) >= star
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-amber-600 mt-1">
              {rating === 5 && '🌟 Outstanding Experience'}
              {rating === 4 && '👍 Good / Satisfied'}
              {rating === 3 && '😐 Average Resolution'}
              {rating === 2 && '👎 Below Expectations'}
              {rating === 1 && '⚠️ Very Unsatisfied'}
            </p>
          </div>

          <div className="text-left">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Select Tags (Optional)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                      active
                        ? 'bg-amber-500 text-white border-amber-500 font-semibold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-left">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Your Review / Feedback
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share any comments for the field crew or city engineers..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Citizen Rating</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
