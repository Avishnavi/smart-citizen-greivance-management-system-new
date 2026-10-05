import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Sparkles,
  RefreshCw,
  Volume2,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { transcribeAudio } from '../../services/aiService';

export type RecordingStatus =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'RECORDING'
  | 'PROCESSING_RECORDING'
  | 'RECORDED'
  | 'PLAYING'
  | 'PERMISSION_DENIED'
  | 'NO_MICROPHONE'
  | 'UNSUPPORTED_BROWSER'
  | 'RECORDING_ERROR'
  | 'EMPTY_RECORDING';

// Custom interface for Web Speech API
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

/**
 * Dynamically check and return the best supported MIME type for the user's browser.
 * Safari / iOS requires audio/mp4, whereas Chrome / Firefox prefer audio/webm or audio/ogg.
 */
function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
  ];
  for (const type of candidateTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onAudioReady,
  onTranscriptionAvailable,
  initialAudioUrl,
  initialDuration,
}) => {
  const [status, setStatus] = useState<RecordingStatus>(
    initialAudioUrl ? 'RECORDED' : 'IDLE'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(initialAudioUrl);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [finalDuration, setFinalDuration] = useState<number>(initialDuration || 0);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);

  // Diagnostic state for dev testing
  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    mimeType: string;
    chunksCount: number;
    blobSize: number;
    durationSec: number;
  }>({
    mimeType: '',
    chunksCount: 0,
    blobSize: 0,
    durationSec: 0,
  });

  // Critical operational refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedSecondsRef = useRef<number>(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const activeMimeTypeRef = useRef<string>('');

  // Speech Recognition refs (optional real-time transcript preview)
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechTranscriptRef = useRef<string>('');
  const accumulatedFinalRef = useRef<string>('');
  const latestInterimRef = useRef<string>('');

  const [prevInitialAudioUrl, setPrevInitialAudioUrl] = useState(initialAudioUrl);

  // Synchronize with external initialAudioUrl changes
  if (initialAudioUrl !== prevInitialAudioUrl) {
    setPrevInitialAudioUrl(initialAudioUrl);
    setAudioUrl(initialAudioUrl);
    if (initialAudioUrl) {
      setStatus('RECORDED');
      if (initialDuration) setFinalDuration(initialDuration);
    } else {
      setStatus('IDLE');
    }
  }

  // Clean up all media streams, timers, and object URLs on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, []);

  const cleanupPreviousAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
  };

  const startRecording = async () => {
    cleanupPreviousAudio();
    setErrorMessage(null);
    setTranscriptionText(null);
    setRecordingTime(0);
    setPlaybackTime(0);
    audioChunksRef.current = [];
    speechTranscriptRef.current = '';
    accumulatedFinalRef.current = '';
    latestInterimRef.current = '';

    // 1. Check browser environment support
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setStatus('UNSUPPORTED_BROWSER');
      setErrorMessage(
        'Your browser does not support audio recording (navigator.mediaDevices.getUserMedia is unavailable). Please use Chrome, Edge, Safari, or Firefox.'
      );
      return;
    }

    if (typeof window.MediaRecorder === 'undefined') {
      setStatus('UNSUPPORTED_BROWSER');
      setErrorMessage(
        'The MediaRecorder API is not supported in this browser. Please use an updated modern browser.'
      );
      return;
    }

    // 2. Request microphone permission & stream
    setStatus('REQUESTING_PERMISSION');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('PERMISSION_DENIED');
        setErrorMessage(
          'Microphone access is required to record your complaint. Please allow microphone access in your browser settings.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStatus('NO_MICROPHONE');
        setErrorMessage(
          'No microphone device was detected on your system. Please connect a microphone and try again.'
        );
      } else {
        setStatus('RECORDING_ERROR');
        setErrorMessage(
          `Unable to access microphone: ${err.message || 'Unknown device error'}. Please check device permissions.`
        );
      }
      return;
    }

    // 3. Optional real-time speech recognition (progressive enhancement, won't break recording)
    try {
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

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
          console.warn('Speech recognition warning:', event?.error);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      }
    } catch (speechErr) {
      console.warn('SpeechRecognition unavailable or disabled:', speechErr);
    }

    // 4. Detect supported MIME type & initialize MediaRecorder
    const supportedMime = getSupportedMimeType();
    let mediaRecorder: MediaRecorder;

    try {
      mediaRecorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);
    } catch (recInitErr: any) {
      console.warn('Failed to construct MediaRecorder with mimeType, attempting default:', recInitErr);
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (fallbackErr: any) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStatus('RECORDING_ERROR');
        setErrorMessage('Failed to initialize audio recorder: ' + (fallbackErr.message || 'Unknown error'));
        return;
      }
    }

    mediaRecorderRef.current = mediaRecorder;
    activeMimeTypeRef.current = mediaRecorder.mimeType || supportedMime || 'audio/webm';

    // 5. Collect audio chunks
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    // 6. Handle recording stopped event
    mediaRecorder.onstop = () => {
      setStatus('PROCESSING_RECORDING');

      // Stop all microphone tracks immediately to release the microphone device
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const finalMime = activeMimeTypeRef.current || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });

      // Validate non-empty recording
      if (audioBlob.size === 0) {
        setStatus('EMPTY_RECORDING');
        setErrorMessage(
          'No audio was captured (0 bytes). Please check your microphone input volume and try again.'
        );
        onAudioReady(undefined, undefined, undefined);
        return;
      }

      // Calculate elapsed recording time accurately from high-resolution timer
      const durationSec = Math.max(1, elapsedSecondsRef.current);
      const url = URL.createObjectURL(audioBlob);
      currentObjectUrlRef.current = url;

      setAudioUrl(url);
      setFinalDuration(durationSec);
      setStatus('RECORDED');

      // Update diagnostic state for verification
      setDiagnosticInfo({
        mimeType: finalMime,
        chunksCount: audioChunksRef.current.length,
        blobSize: audioBlob.size,
        durationSec,
      });

      // Pass URL, duration in seconds, and actual Blob to parent component
      onAudioReady(url, durationSec, audioBlob);
    };

    // 7. Start recording with 1-second timeslice
    try {
      mediaRecorder.start(1000);
    } catch (startErr: any) {
      console.error('mediaRecorder.start() failed:', startErr);
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus('RECORDING_ERROR');
      setErrorMessage('Could not start audio recording: ' + (startErr.message || 'Unknown error'));
      return;
    }

    // 8. Start accurate elapsed timer
    startTimeRef.current = Date.now();
    elapsedSecondsRef.current = 0;
    setRecordingTime(0);
    setStatus('RECORDING');

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      elapsedSecondsRef.current = elapsed;
      setRecordingTime(elapsed);
    }, 250);
  };

  const stopRecording = () => {
    // 1. Freeze timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (startTimeRef.current) {
      const elapsed = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
      elapsedSecondsRef.current = elapsed;
      setRecordingTime(elapsed);
    }

    // 2. Stop speech recognition
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

    // 3. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (typeof mediaRecorderRef.current.requestData === 'function') {
          try {
            mediaRecorderRef.current.requestData();
          } catch {
            // ignore
          }
        }
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setStatus('IDLE');
    }
  };

  const discardRecording = () => {
    cleanupPreviousAudio();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    setAudioUrl(undefined);
    setRecordingTime(0);
    setFinalDuration(0);
    setPlaybackTime(0);
    setTranscriptionText(null);
    setErrorMessage(null);
    speechTranscriptRef.current = '';
    accumulatedFinalRef.current = '';
    latestInterimRef.current = '';
    audioChunksRef.current = [];
    setStatus('IDLE');
    onAudioReady(undefined, undefined, undefined);
  };

  const handleReRecord = () => {
    discardRecording();
    setTimeout(() => {
      startRecording();
    }, 60);
  };

  const togglePlayback = () => {
    if (!audioElementRef.current) return;
    if (status === 'PLAYING') {
      audioElementRef.current.pause();
      setStatus('RECORDED');
    } else {
      audioElementRef.current
        .play()
        .then(() => {
          setStatus('PLAYING');
        })
        .catch((err) => {
          console.warn('Audio playback error:', err);
          setStatus('RECORDED');
        });
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioElementRef.current) {
      setPlaybackTime(audioElementRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setStatus('RECORDED');
    setPlaybackTime(0);
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = 0;
    }
  };

  const handleAudioPause = () => {
    if (status === 'PLAYING') {
      setStatus('RECORDED');
    }
  };

  const handleAudioPlay = () => {
    setStatus('PLAYING');
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
    const s = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRecording = status === 'RECORDING';
  const isPlaying = status === 'PLAYING';
  const displayDuration = finalDuration || initialDuration || recordingTime || 0;
  const progressPercent = displayDuration > 0
    ? Math.min(100, Math.max(0, (playbackTime / displayDuration) * 100))
    : 0;

  return (
    <div className="bg-slate-50/90 border border-slate-200/80 rounded-3xl p-4 sm:p-5 transition-all shadow-xs">
      {/* Top Header */}
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
            onClick={discardRecording}
            className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-bold hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
        )}
      </div>

      {/* Error / Alert banner */}
      {errorMessage && (
        <div className="mb-3.5 p-3.5 bg-rose-50 border border-rose-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-800 animate-in fade-in shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={startRecording}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition self-end sm:self-auto shrink-0 shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Requesting Permission State */}
      {status === 'REQUESTING_PERMISSION' && (
        <div className="p-4 bg-sky-50 border border-sky-200/80 rounded-2xl flex items-center gap-3 text-xs text-sky-800 animate-in fade-in">
          <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
          <span className="font-medium">Requesting microphone permission from browser... Please allow access.</span>
        </div>
      )}

      {/* Processing Recording State */}
      {status === 'PROCESSING_RECORDING' && (
        <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3 text-xs text-slate-700 animate-in fade-in">
          <Loader2 className="w-4 h-4 text-slate-600 animate-spin shrink-0" />
          <span className="font-medium">Saving audio recording...</span>
        </div>
      )}

      {/* Idle State - Initial Record Button */}
      {!audioUrl && !isRecording && status !== 'REQUESTING_PERMISSION' && status !== 'PROCESSING_RECORDING' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs text-slate-500 text-center sm:text-left space-y-0.5">
            <span className="font-semibold text-slate-700 block">Tap microphone to describe verbally</span>
            <span className="text-[11px] text-slate-400">Supports English, Hindi, Tamil & regional dialects</span>
          </div>
          <button
            type="button"
            onClick={startRecording}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm shadow-rose-500/20 transition hover:scale-[1.02] active:scale-98 cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Record Voice Note</span>
          </button>
        </div>
      )}

      {/* Active Recording State */}
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
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-3"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-5"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-2"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-4"></span>
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-3"></span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Finish Recording</span>
          </button>
        </div>
      )}

      {/* Recorded Audio State */}
      {audioUrl && !isRecording && (
        <div className="space-y-3">
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="p-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl flex items-center justify-center shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  title={isPlaying ? 'Pause Recording' : 'Play Recording'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs text-slate-800 mb-1 font-bold">
                    <span className="flex items-center gap-1.5 text-slate-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Recording Complete</span>
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {formatTimer(playbackTime || displayDuration)} / {formatTimer(displayDuration)}
                    </span>
                  </div>

                  {/* Dynamic Progress Bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-150"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* AI Transcribe Button */}
              <button
                type="button"
                onClick={handleWhisperTranscribe}
                disabled={isTranscribing}
                className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-sky-50 hover:from-indigo-100 hover:to-sky-100 text-indigo-700 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition border border-indigo-200/60 disabled:opacity-50 cursor-pointer shrink-0"
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

            {/* Standard native audio controls for full browser scrubbing & volume */}
            <audio
              ref={audioElementRef}
              src={audioUrl}
              onTimeUpdate={handleAudioTimeUpdate}
              onEnded={handleAudioEnded}
              onPause={handleAudioPause}
              onPlay={handleAudioPlay}
              controls
              className="w-full h-9 rounded-xl focus:outline-none"
            />

            {/* Action Bar: Re-record or Discard */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Voice note ready & attached to grievance</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReRecord}
                  className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Discard current audio and record again"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-record</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI Transcription preview if available */}
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

          {/* Dev Diagnostic Panel (useful for local verification) */}
          {import.meta.env.DEV && diagnosticInfo.blobSize > 0 && (
            <div className="p-2.5 bg-slate-100/80 border border-slate-200 text-[10px] text-slate-500 rounded-xl space-y-0.5 font-mono">
              <div className="font-bold text-slate-700">Diagnostic Stats:</div>
              <div>MIME: {diagnosticInfo.mimeType} | Size: {(diagnosticInfo.blobSize / 1024).toFixed(1)} KB | Chunks: {diagnosticInfo.chunksCount} | Duration: {diagnosticInfo.durationSec}s</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
