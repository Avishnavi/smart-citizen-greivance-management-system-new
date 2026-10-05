import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useComplaints } from '../context/ComplaintContext';
import { useNotifications } from '../context/NotificationContext';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Bell,
  CheckCircle2,
  Edit,
  Save,
  RotateCcw,
  Building,
  Smartphone,
  MessageSquare
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { profile, updateProfile, setLanguage, resetProfile } = useAuth();
  const { resetAllToDefault, complaints } = useComplaints();
  const { clearNotifications } = useNotifications();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    ward: profile.ward,
    zone: profile.zone
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleToggleNotif = (key: keyof typeof profile.notificationPreferences) => {
    updateProfile({
      notificationPreferences: {
        ...profile.notificationPreferences,
        [key]: !profile.notificationPreferences[key]
      }
    });
  };

  const handleResetDemo = () => {
    if (window.confirm('Reset all demo complaints and profile data to initial factory state?')) {
      resetAllToDefault();
      resetProfile();
      clearNotifications();
      alert('Demo data has been reset to defaults.');
    }
  };

  const languages = [
    { code: 'English', label: 'English (EN)' },
    { code: 'Tamil', label: 'தமிழ் (Tamil)' },
    { code: 'Hindi', label: 'हिंदी (Hindi)' },
    { code: 'Telugu', label: 'తెలుగు (Telugu)' }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">
            Citizen Management
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Citizen Profile & Civic Ward Details
          </h1>
          <p className="text-xs text-slate-500">
            Manage your personal profile, preferred communication channels, and local municipal ward info.
          </p>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-2xl shadow-sm transition flex items-center gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition"
          >
            Cancel
          </button>
        )}
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Profile changes updated successfully!</span>
        </div>
      )}

      {/* Main Profile Info Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        {/* Avatar & ID Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover ring-4 ring-sky-500/20 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {profile.name}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                  Verified Resident
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Citizen ID: <strong className="text-slate-800 font-mono">{profile.id}</strong>
              </p>
              <p className="text-xs text-sky-700 font-semibold mt-0.5">
                {profile.ward} • {profile.zone}
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
            <span className="text-slate-500 font-medium block">Lifetime Grievances:</span>
            <span className="text-lg font-mono font-extrabold text-slate-900 block">
              {complaints.length} Tickets Registered
            </span>
          </div>
        </div>

        {/* Profile Fields or Edit Form */}
        {!isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <User className="w-3.5 h-3.5" />
                <span>Full Name</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{profile.name}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <Phone className="w-3.5 h-3.5" />
                <span>Mobile Phone</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{profile.phone}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <Mail className="w-3.5 h-3.5" />
                <span>Email Address</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{profile.email}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <MapPin className="w-3.5 h-3.5" />
                <span>Residential Address</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{profile.address}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ward</label>
                <input
                  type="text"
                  value={formData.ward}
                  onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Residential Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-md transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Preferences: Language & Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Preferred Language */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Globe className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Preferred Language</h3>
          </div>
          <p className="text-xs text-slate-500">
            Select your preferred portal and notification dispatch language.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`p-3 rounded-2xl border text-left text-xs font-semibold transition ${
                  profile.preferredLanguage === lang.code
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Notification Channels</h3>
          </div>
          <p className="text-xs text-slate-500">
            Real-time status alerts for officer assignments and closures.
          </p>

          <div className="space-y-2.5 pt-1 text-xs">
            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-600" />
                <span className="font-semibold text-slate-800">SMS Alerts</span>
              </div>
              <input
                type="checkbox"
                checked={profile.notificationPreferences.sms}
                onChange={() => handleToggleNotif('sms')}
                className="w-4 h-4 text-sky-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">WhatsApp Updates</span>
              </div>
              <input
                type="checkbox"
                checked={profile.notificationPreferences.whatsapp}
                onChange={() => handleToggleNotif('whatsapp')}
                className="w-4 h-4 text-sky-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-600" />
                <span className="font-semibold text-slate-800">Email Notifications</span>
              </div>
              <input
                type="checkbox"
                checked={profile.notificationPreferences.email}
                onChange={() => handleToggleNotif('email')}
                className="w-4 h-4 text-sky-600 rounded"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Ward Info & Demo Reset Box */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Building className="w-4 h-4 text-sky-400" />
            <h4 className="font-bold text-sm">Zone 8 Municipal Ward Office</h4>
          </div>
          <p className="text-xs text-slate-400">
            Assistant Commissioner Office • 2nd Avenue, Anna Nagar • Phone: 044-2615 0000
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDemo}
          className="px-4 py-2 bg-slate-800 hover:bg-rose-900/80 text-rose-300 hover:text-white text-xs font-bold rounded-2xl border border-slate-700 transition flex items-center gap-1.5 whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>
    </div>
  );
};
