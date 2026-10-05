import React, { useState } from 'react';
import { useComplaints } from '../../context/ComplaintContext';
import { VoiceRecorder } from './VoiceRecorder';
import { ImageUploader } from './ImageUploader';
import { AIAssistantModal } from './AIAssistantModal';
import {
  FileText,
  Mic,
  Image as ImageIcon,
  ArrowRight,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface Step1InputMethodProps {
  onNext: () => void;
}

export const Step1InputMethod: React.FC<Step1InputMethodProps> = ({ onNext }) => {
  const { draft, updateDraft } = useComplaints();
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateDraft({ description: e.target.value });
    if (validationError) setValidationError(null);
  };

  const handleAudioReady = (
    audioUrl?: string,
    durationSeconds?: number,
    blob?: Blob
  ) => {
    updateDraft({
      voiceUrl: audioUrl,
      voiceDuration: durationSeconds,
      voiceBlob: blob
    });
    if (validationError) setValidationError(null);
  };

  const handleTranscriptionAvailable = (transcribedText: string) => {
    const cleanText = transcribedText.trim();
    if (!cleanText) return;
    updateDraft({
      description: cleanText
    });
    if (validationError) setValidationError(null);
  };

  const handleImagesChange = (imageUrls: string[]) => {
    updateDraft({ imageUrls });
    if (validationError) setValidationError(null);
  };

  const handleProceed = () => {
    const hasText = Boolean(draft.description && draft.description.trim().length >= 5);
    const hasVoice = Boolean(draft.voiceUrl || draft.voiceBlob);
    const hasImage = Boolean(draft.imageUrls && draft.imageUrls.length > 0);

    if (!hasText && !hasVoice && !hasImage) {
      setValidationError(
        'Please describe your grievance using text, record a voice note, or attach a photo to continue.'
      );
      return;
    }

    onNext();
  };

  const quickTemplates = [
    { title: 'Dangerous Pothole', text: 'Deep dangerous pothole near the road junction causing vehicular slowdown and hazard.' },
    { title: 'Sewage Overflow', text: 'Sewage manhole overflowing on the main street with strong foul odor in residential zone.' },
    { title: 'Broken Streetlight', text: 'Streetlights non-functional for 3 consecutive days, leaving the lane in pitch darkness.' },
    { title: 'Garbage Dump', text: 'Commercial garbage bin overflowing with uncollected municipal waste and plastic bags.' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white/95 rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 backdrop-blur-md">
        {/* Step Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200/60 rounded-md">
                Step 1 of 4
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Describe Issue
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Provide details using text, voice note, or photos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAIAssistantOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-500/20 transition hover:scale-[1.02] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-200" />
            <span>AI Assistant</span>
          </button>
        </div>

        {/* Input Channels Summary */}
        <div className="grid grid-cols-3 gap-2.5 p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2 p-1">
            <div className={`p-1.5 rounded-lg transition ${draft.description.trim() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-400'}`}>
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="font-bold text-slate-800 block truncate text-xs">Text</span>
              <span className="text-[10px] text-slate-400">
                {draft.description.trim() ? `${draft.description.trim().length} chars` : 'Optional'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1">
            <div className={`p-1.5 rounded-lg transition ${draft.voiceUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-400'}`}>
              <Mic className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="font-bold text-slate-800 block truncate text-xs">Voice</span>
              <span className="text-[10px] text-slate-400">
                {draft.voiceUrl ? 'Attached' : 'Optional'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1">
            <div className={`p-1.5 rounded-lg transition ${draft.imageUrls.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-400'}`}>
              <ImageIcon className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="font-bold text-slate-800 block truncate text-xs">Photos</span>
              <span className="text-[10px] text-slate-400">
                {draft.imageUrls.length > 0 ? `${draft.imageUrls.length} file(s)` : 'Optional'}
              </span>
            </div>
          </div>
        </div>

        {/* Textarea Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="description" className="text-xs font-bold text-slate-800">
              Description
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              {draft.description.length} chars
            </span>
          </div>

          <div className="relative">
            <textarea
              id="description"
              rows={4}
              value={draft.description}
              onChange={handleTextChange}
              placeholder="Describe what needs repair or attention (e.g. 'Pothole on 2nd Avenue causing hazard')..."
              className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 leading-relaxed resize-y transition shadow-2xs"
            />
          </div>

          {/* Quick starter buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-400">Quick Picks:</span>
            {quickTemplates.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => updateDraft({ description: tmpl.text })}
                className="text-[11px] font-medium px-2 py-0.5 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
              >
                + {tmpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Studio Voice Recorder */}
        <VoiceRecorder
          initialAudioUrl={draft.voiceUrl}
          initialDuration={draft.voiceDuration}
          onAudioReady={handleAudioReady}
          onTranscriptionAvailable={handleTranscriptionAvailable}
        />

        {/* Image Uploader */}
        <ImageUploader
          imageUrls={draft.imageUrls}
          onImagesChange={handleImagesChange}
        />

        {/* Validation Error Alert */}
        {validationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Bottom Proceed Action */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={handleProceed}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-sky-600/25 transition hover:scale-[1.01] active:scale-98 cursor-pointer"
          >
            <span>Next: Location</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        initialText={draft.description}
        onApplyDescription={(text) => {
          updateDraft({ description: text });
          if (validationError) setValidationError(null);
        }}
      />
    </div>
  );
};
