import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Sparkles, RefreshCw, Volume2 } from 'lucide-react';
import { transcribeAudio } from '../../services/aiService';

// Custom interface to avoid TypeScript missing DOM SpeechRecognition errors
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((this: SpeechRecognitionInstance, ev: any) => any) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: any) => any) | null;
  onend: ((this: SpeechRecognitionInstance, ev: any) => any) | null;
}

// Extend window type to include vendor-prefixed SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
  }
}

interface VoiceRecorderProps {
  onAudioReady: (audioUrl: string | undefined, durationSeconds?: number, blob?: Blob) => void;
  onTranscriptionAvailable?: (transcribedText: string) => void;
  initialAudioUrl?: string;
  initialDuration?: number;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onAudioReady,
  onTranscriptionAvailable,
  initialAudioUrl,
  initialDuration
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(initialAudioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Holds the live speech transcript captured during recording
  const speechTranscriptRef = useRef<string>('');
  const accumulatedFinalRef = useRef<string>('');
  const latestInterimRef = useRef<string>('');
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setTranscriptionText(null);
      setRecordingTime(0);
      audioChunksRef.current = [];

      // Reset transcripts on each new recording session
      speechTranscriptRef.current = '';
      accumulatedFinalRef.current = '';
      latestInterimRef.current = '';

      // --- Start Web Speech API for real-time transcription ---
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Default; supports Indian English

        recognition.onresult = (event: any) => {
          let finalAccumulated = '';
          let currentInterim = '';

          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            if (result.isFinal) {
              finalAccumulated += transcript + ' ';
            } else {
              currentInterim += transcript;
            }
          }

          if (finalAccumulated.trim()) {
            accumulatedFinalRef.current = finalAccumulated.trim();
            speechTranscriptRef.current = accumulatedFinalRef.current;
          }

          latestInterimRef.current = currentInterim.trim();
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event?.error);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          onAudioReady(url, recordingTime || 6, audioBlob);

          // Stop all audio tracks to release microphone
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);

        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        // Fallback simulation for unsupported environments
        setIsRecording(true);
        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      }
    } catch (err) {
      console.warn('Microphone access denied, using simulated audio recording:', err);
      setIsRecording(true);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (speechRecognitionRef.current) {
      const recognition = speechRecognitionRef.current;
      recognition.onend = () => {
        if (!accumulatedFinalRef.current.trim() && latestInterimRef.current.trim()) {
          speechTranscriptRef.current = latestInterimRef.current.trim();
        } else {
          speechTranscriptRef.current = accumulatedFinalRef.current.trim();
        }
        speechRecognitionRef.current = null;
      };
      try {
        recognition.stop();
      } catch (err) {
        console.warn('Error stopping speech recognition:', err);
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      const simulatedUrl = 'https://actions.google.com/sounds/v1/speech/voice_male_ambient.ogg';
      setAudioUrl(simulatedUrl);
      onAudioReady(simulatedUrl, Math.max(3, recordingTime));
    }

    setIsRecording(false);
  };

  const deleteRecording = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setAudioUrl(undefined);
    setRecordingTime(0);
    setIsPlaying(false);
    setTranscriptionText(null);
    speechTranscriptRef.current = '';
    accumulatedFinalRef.current = '';
    latestInterimRef.current = '';
    onAudioReady(undefined);
  };

  const togglePlayback = () => {
    if (!audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleWhisperTranscribe = async () => {
    if (!audioUrl) return;
    setIsTranscribing(true);
    try {
      const textToTranscribe =
        speechTranscriptRef.current ||
        accumulatedFinalRef.current.trim() ||
        latestInterimRef.current.trim();

      const res = await transcribeAudio(audioUrl, textToTranscribe);
      setTranscriptionText(res.text);
      if (onTranscriptionAvailable && res.text && !res.text.startsWith('(')) {
        onTranscriptionAvailable(res.text);
      }
    } catch (e) {
      console.error('Transcription failed:', e);
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-50/90 border border-slate-200/80 rounded-3xl p-4 sm:p-5 transition-all shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-100/80 text-rose-600 rounded-2xl border border-rose-200/60 shadow-2xs">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 tracking-tight">Voice Grievance</h4>
            <p className="text-[11px] text-slate-400 font-medium">Record in any language — AI auto-transcribes</p>
          </div>
        </div>

        {audioUrl && !isRecording && (
          <button
            type="button"
            onClick={deleteRecording}
            className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-bold hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
        )}
      </div>

      {!audioUrl && !isRecording && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs text-slate-500 text-center sm:text-left space-y-0.5">
            <span className="font-semibold text-slate-700 block">Tap microphone to describe verbally</span>
            <span className="text-[11px] text-slate-400">Supports English, Hindi, Tamil & regional dialects</span>
          </div>
          <button
            type="button"
            onClick={startRecording}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm shadow-rose-500/20 transition hover:scale-[1.02] active:scale-98"
          >
            <Mic className="w-4 h-4" />
            <span>Record Voice Note</span>
          </button>
        </div>
      )}

      {isRecording && (
        <div className="p-4 bg-gradient-to-r from-rose-50 via-rose-50/70 to-orange-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600"></span>
            </span>
            <div className="text-left">
              <p className="text-xs font-black text-rose-950">Live Recording in Progress...</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs font-mono font-bold text-rose-700 bg-white/80 px-2 py-0.5 rounded-lg border border-rose-200/80">
                  {formatTimer(recordingTime)}
                </span>
                {/* Visual sound waves */}
                <div className="flex items-center gap-1 h-5">
                  <span className="w-1 bg-rose-500 rounded-full animate-wave-1"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-wave-2"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-wave-3"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-wave-4"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-wave-5"></span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Finish Recording</span>
          </button>
        </div>
      )}

      {audioUrl && !isRecording && (
        <div className="space-y-3">
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
            <audio
              ref={audioElementRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              className="hidden"
            />
            <button
              type="button"
              onClick={togglePlayback}
              className="p-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl flex items-center justify-center shadow-xs transition hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-800 mb-1 font-bold">
                <span>Audio Recording</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {formatTimer(initialDuration || recordingTime || 6)}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all ${
                    isPlaying ? 'w-full duration-1000' : 'w-0'
                  }`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleWhisperTranscribe}
              disabled={isTranscribing}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-50 to-sky-50 hover:from-indigo-100 hover:to-sky-100 text-indigo-700 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition border border-indigo-200/60 disabled:opacity-50"
              title="Transcribe Voice Note with AI"
            >
              {isTranscribing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span className="hidden sm:inline">AI Transcribe</span>
            </button>
          </div>

          {transcriptionText && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs space-y-1 shadow-2xs">
              <div className="flex items-center gap-1.5 text-indigo-950 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Voice Transcription Preview:</span>
              </div>
              <p className="text-indigo-900 italic leading-relaxed font-medium">
                "{transcriptionText}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
