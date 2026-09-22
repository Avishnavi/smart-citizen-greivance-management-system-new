import React, { useState, useEffect } from 'react';
import type { Complaint, Department, ComplaintStatus } from '../../types';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import {
  X,
  MapPin,
  CheckCircle2,
  Volume2,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  User,
  Camera,
  Upload,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const ALL_DEPARTMENTS: Department[] = [
  'Road Maintenance Department',
  'Water & Sewerage Board',
  'Electricity & Lighting Department',
  'Solid Waste Management',
  'Traffic & Transport Department',
  'Public Health & Sanitation',
  'Town Planning & Enforcement',
  'Horticulture & Parks',
];

export const ALL_STATUSES: ComplaintStatus[] = [
  'Pending',
  'In Progress',
  'Resolved',
  'Rejected',
];

export const RESOLUTION_PHOTO_PRESETS = [
  {
    label: 'Road Repaired',
    icon: '🛣️',
    url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    defaultNotes: 'Road pothole filled with asphalt aggregate and resurfaced to level.',
  },
  {
    label: 'Streetlight Fixed',
    icon: '💡',
    url: 'https://images.unsplash.com/photo-1507034589631-9433cc6bc453?auto=format&fit=crop&w=800&q=80',
    defaultNotes: 'Faulty LED fixture and circuit relay replaced; illumination restored.',
  },
  {
    label: 'Garbage Cleared',
    icon: '🧹',
    url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80',
    defaultNotes: 'Sanitation team cleared all accumulated solid waste and disinfected area.',
  },
  {
    label: 'Pipeline Repaired',
    icon: '🚰',
    url: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80',
    defaultNotes: 'Underground pipeline leakage repaired with pressure sleeve; supply restored.',
  },
  {
    label: 'Park Restored',
    icon: '🌳',
    url: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80',
    defaultNotes: 'Overgrown branches pruned and civic park pathway cleared.',
  },
];

interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  onClose: () => void;
  onUpdateStatus: (
    id: string,
    status: ComplaintStatus,
    resolutionData?: {
      proofImageUrl?: string;
      resolutionNotes?: string;
      officerName?: string;
    }
  ) => void;
  onUpdateDepartment: (id: string, department: Department) => void;
  onViewOnMap?: (complaint: Complaint) => void;
  initialStatus?: ComplaintStatus | null;
}

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  complaint,
  onClose,
  onUpdateStatus,
  onUpdateDepartment,
  onViewOnMap,
  initialStatus,
}) => {
  if (!complaint) return null;

  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>(
    initialStatus || complaint.status
  );
  const [selectedDept, setSelectedDept] = useState<Department>(complaint.department);
  const [resolutionProof, setResolutionProof] = useState<string>(
    complaint.resolution?.proofImageUrl || ''
  );
  const [resolutionNotes, setResolutionNotes] = useState<string>(
    complaint.resolution?.resolutionNotes || ''
  );
  const [officerName, setOfficerName] = useState<string>(
    complaint.resolution?.officerName || 'Admin Officer / Field Team'
  );
  const [isSaved, setIsSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync state when complaint or initialStatus changes
  useEffect(() => {
    if (complaint) {
      setSelectedStatus(initialStatus || complaint.status);
      setSelectedDept(complaint.department);
      setResolutionProof(complaint.resolution?.proofImageUrl || '');
      setResolutionNotes(
        complaint.resolution?.resolutionNotes ||
          (initialStatus === 'Resolved' && !complaint.resolution?.resolutionNotes
            ? 'Inspected by municipal field team and completed to standard.'
            : '')
      );
      setOfficerName(
        complaint.resolution?.officerName || 'Admin Officer / Field Team'
      );
      setIsSaved(false);
      setUploadError(null);
    }
  }, [complaint, initialStatus]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10MB limit.');
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setResolutionProof(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyChanges = () => {
    const isResolving = selectedStatus === 'Resolved';
    const hasResolutionChanged =
      isResolving &&
      (resolutionProof !== (complaint.resolution?.proofImageUrl || '') ||
        resolutionNotes !== (complaint.resolution?.resolutionNotes || '') ||
        officerName !== (complaint.resolution?.officerName || ''));

    if (selectedStatus !== complaint.status || hasResolutionChanged) {
      const resolutionData = isResolving
        ? {
            proofImageUrl: resolutionProof || undefined,
            resolutionNotes:
              resolutionNotes.trim() ||
              'Civic grievance inspected and resolved by municipal field team.',
            officerName: officerName.trim() || 'Admin Officer / Field Team',
          }
        : undefined;

      onUpdateStatus(complaint.id, selectedStatus, resolutionData);
    }

    if (selectedDept !== complaint.department) {
      onUpdateDepartment(complaint.id, selectedDept);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-100 text-sky-700 rounded-2xl">
              <CategoryIcon category={complaint.category} className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {complaint.id}
                </h3>
                <PriorityBadge priority={complaint.priority} size="sm" />
              </div>
              <p className="text-xs text-slate-500">
                Logged on {new Date(complaint.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Quick Action Control Bar */}
          <div className="p-4 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-600" />
                Administrative Controls
              </span>
              {isSaved && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Changes Applied
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Workflow Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as ComplaintStatus)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-hidden cursor-pointer"
                >
                  {ALL_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Assign Department
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as Department)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-hidden cursor-pointer truncate"
                >
                  {ALL_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ==================================================== */}
            {/* RESOLUTION PHOTO EVIDENCE & FIELD REPORT (ADMIN)     */}
            {/* ==================================================== */}
            {selectedStatus === 'Resolved' && (
              <div className="pt-2 border-t border-sky-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Resolution Proof Photo & Field Verification
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Audit Proof
                  </span>
                </div>

                {uploadError && (
                  <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-xl">
                    {uploadError}
                  </p>
                )}

                {/* Photo Upload or Preview */}
                {resolutionProof ? (
                  <div className="space-y-2 bg-white/90 p-3 rounded-2xl border border-emerald-300/80 shadow-2xs">
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                      <img
                        src={resolutionProof}
                        alt="Resolution Evidence Preview"
                        className="w-full h-44 sm:h-52 object-cover object-center"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-between p-2.5">
                        <div className="flex justify-end">
                          <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-sm">
                            <Check className="w-3 h-3" /> Photo Attached
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/90 font-medium truncate max-w-[200px]">
                            {resolutionProof.startsWith('data:')
                              ? 'Device photo uploaded'
                              : 'Verified sample image'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <label className="px-2.5 py-1 bg-white/90 hover:bg-white text-slate-800 font-bold rounded-lg text-[10px] cursor-pointer shadow-sm transition">
                              Replace Photo
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageFileChange}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setResolutionProof('')}
                              className="p-1 bg-rose-600/90 hover:bg-rose-700 text-white rounded-lg transition"
                              title="Remove photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 bg-white/90 p-3 rounded-2xl border border-dashed border-emerald-300">
                    {/* File Upload Trigger */}
                    <label className="border border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition group">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center mb-1.5 transition">
                        <Upload className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-slate-800 text-xs">
                        Upload Resolution Photo
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Choose photo of resolved site (PNG, JPG, WebP up to 10MB)
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>

                    {/* Quick Demo Presets */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Or select quick demo resolution photo:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {RESOLUTION_PHOTO_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setResolutionProof(preset.url);
                              if (!resolutionNotes) {
                                setResolutionNotes(preset.defaultNotes);
                              }
                            }}
                            className="px-2 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 text-left transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{preset.icon}</span>
                            <span className="truncate">{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Resolution Notes & Officer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                      Resolution Remarks & Action Taken
                    </label>
                    <input
                      type="text"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="e.g. Repaired street lighting contactor and restored illumination."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                      Resolving Officer / Unit
                    </label>
                    <input
                      type="text"
                      value={officerName}
                      onChange={(e) => setOfficerName(e.target.value)}
                      placeholder="e.g. Field Engineer Unit 3"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                {selectedStatus === 'Resolved' && !resolutionProof
                  ? 'Note: Attaching resolution photo is recommended for audit proof.'
                  : 'Updates sync with audit timeline and citizen tracking.'}
              </span>
              <button
                type="button"
                onClick={handleApplyChanges}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
              >
                Save Updates
              </button>
            </div>
          </div>

          {/* Grievance Description */}
          <div className="space-y-1.5">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Grievance Description
            </span>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 leading-relaxed text-slate-800 whitespace-pre-wrap">
              {complaint.description || 'No textual description provided.'}
            </div>
          </div>

          {/* Location & Citizen details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                Geographic Location
              </span>
              <div className="flex items-start gap-2 pt-1">
                <MapPin className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 leading-tight truncate">
                    {complaint.location.address}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {complaint.location.ward || 'Ward 102'} •{' '}
                    {complaint.location.zone || 'Zone 8'} (
                    {complaint.location.latitude.toFixed(4)},{' '}
                    {complaint.location.longitude.toFixed(4)})
                  </p>
                  {onViewOnMap && (
                    <button
                      type="button"
                      onClick={() => {
                        onViewOnMap(complaint);
                        onClose();
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-800 font-bold hover:underline"
                    >
                      <span>Show on Hotspot Map</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                Citizen Information
              </span>
              <div className="flex items-center gap-2 pt-1">
                <User className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="font-bold text-slate-800">
                    Citizen ID: {complaint.userId}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Priority Score: <strong className="text-slate-700">{complaint.priorityScore || 75}/100</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis Summary */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI Automated Triage Index</span>
              </div>
              <span className="text-[11px] bg-indigo-200/70 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                XLM-RoBERTa + XGBoost
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="bg-white/90 p-2 rounded-xl border border-indigo-100/80">
                <span className="text-slate-400 block text-[10px]">Category</span>
                <span className="font-bold text-slate-800">{complaint.category}</span>
              </div>
              <div className="bg-white/90 p-2 rounded-xl border border-indigo-100/80">
                <span className="text-slate-400 block text-[10px]">Priority Score</span>
                <span className="font-bold text-slate-800">{complaint.priorityScore || 70}/100</span>
              </div>
              <div className="bg-white/90 p-2 rounded-xl border border-indigo-100/80 col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[10px]">Duplicate Check</span>
                <span className="font-bold text-slate-800">
                  {complaint.duplicateStatus === 'possible_duplicate'
                    ? '⚠️ Possible Duplicate'
                    : '✓ Distinct Issue'}
                </span>
              </div>
            </div>

            {complaint.duplicateStatus === 'possible_duplicate' && (
              <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
                Similar to complaint <strong>{complaint.similarComplaintId || 'CMP-2026-001245'}</strong> with{' '}
                {complaint.similarityScore ? `${Math.round(complaint.similarityScore * 100)}%` : '85%'} semantic match.
              </div>
            )}
          </div>

          {/* Media Attachments */}
          {(complaint.imageUrls?.length || complaint.voiceUrl) && (
            <div className="space-y-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Attached Media Evidence
              </span>
              <div className="flex flex-wrap gap-3">
                {complaint.voiceUrl && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 max-w-sm">
                    <Volume2 className="w-5 h-5 text-rose-600" />
                    <div>
                      <p className="font-bold text-rose-900 text-xs">Audio Recording</p>
                      <p className="text-[10px] text-rose-600 font-mono">
                        {complaint.voiceDuration ? `${complaint.voiceDuration}s voice note` : 'Audio file'}
                      </p>
                    </div>
                    <audio src={complaint.voiceUrl} controls className="h-8 max-w-[160px]" />
                  </div>
                )}

                {complaint.imageUrls?.map((img, idx) => (
                  <a
                    key={idx}
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="relative group rounded-2xl overflow-hidden border border-slate-200 block w-24 h-24 hover:opacity-90 transition"
                  >
                    <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Verified Resolution Record */}
          {complaint.resolution && (
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Official Field Resolution & Verification
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full">
                  Resolved on {new Date(complaint.resolution.resolvedAt).toLocaleDateString()}
                </span>
              </div>

              {complaint.resolution.proofImageUrl && (
                <div className="rounded-xl overflow-hidden border border-emerald-200 bg-slate-900 max-w-md">
                  <img
                    src={complaint.resolution.proofImageUrl}
                    alt="Official Resolution Proof"
                    className="w-full h-44 sm:h-48 object-cover"
                  />
                  <div className="p-2 bg-emerald-100/90 flex items-center justify-between text-[11px] text-emerald-900">
                    <span className="font-bold flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-emerald-700" />
                      Field Work Proof Photo
                    </span>
                    <a
                      href={complaint.resolution.proofImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-emerald-800 font-bold hover:underline flex items-center gap-1"
                    >
                      <span>View Full Image</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              <p className="text-xs text-emerald-950 italic bg-white/90 p-2.5 rounded-xl border border-emerald-100">
                "{complaint.resolution.resolutionNotes}"
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-800">
                <span>Verified by: <strong>{complaint.resolution.officerName}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('Resolved')}
                  className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline text-[10px] cursor-pointer"
                >
                  Edit Resolution / Update Photo
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          {complaint.timeline && complaint.timeline.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Workflow Timeline & Action Log
              </span>
              <div className="space-y-2">
                {complaint.timeline.map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{event.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {event.timestamp && event.timestamp !== 'Pending'
                            ? new Date(event.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Pending'}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">{event.description}</p>
                      {event.officerName && (
                        <p className="text-[10px] text-slate-400 font-medium">
                          Officer: {event.officerName} {event.department ? `(${event.department})` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
