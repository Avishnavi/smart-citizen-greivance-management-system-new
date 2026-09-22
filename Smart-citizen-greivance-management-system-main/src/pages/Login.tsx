import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole, Department } from '../types';
import { CORE_DEPARTMENTS } from '../components/admin/AdminAssignModal';
import {
  Building2,
  Shield,
  Wrench,
  User,
  ArrowRight,
  Lock,
  Mail,
  Phone,
  KeyRound,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Home,
  Eye,
  EyeOff,
} from 'lucide-react';

export const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, quickLogin } = useAuth();

  // Initial role from query param ?role=admin or ?role=officer or default citizen
  const initialRole = (searchParams.get('role') as UserRole) || 'citizen';
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);

  // Form States
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [department, setDepartment] = useState<Department>('Roads & Bridges');
  const [fullName, setFullName] = useState('');
  const [ward, setWard] = useState('Ward 102');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Citizen Login Method Toggle: 'otp' | 'password'
  const [citizenAuthMethod, setCitizenAuthMethod] = useState<'otp' | 'password'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(30);

  // Mode: 'login' | 'register'
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Sync role defaults when activeRole changes
  useEffect(() => {
    setAuthError(null);
    if (activeRole === 'admin') {
      setIdentifier('admin.commissioner@smartcity.gov.in');
      setSecret('••••••••');
    } else if (activeRole === 'officer') {
      setIdentifier('OFF-102');
      setSecret('••••••••');
      setDepartment('Roads & Bridges');
    } else {
      setIdentifier('rajesh.kumar88@example.gov.in');
      setSecret('••••••••');
    }
  }, [activeRole]);

  // OTP Countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpSent, otpTimer]);

  const handleSendOtp = () => {
    if (!identifier.trim()) {
      setAuthError('Please enter your mobile number or email address.');
      return;
    }
    setIsLoading(true);
    setAuthError(null);
    setTimeout(() => {
      setIsLoading(false);
      setOtpSent(true);
      setOtpCode('742819'); // Mock OTP
      setOtpTimer(30);
    }, 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setAuthError('Please enter your user ID, email, or mobile number.');
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      const loggedUser = await login(activeRole, {
        identifier: identifier.trim(),
        secret: secret.trim(),
        department: activeRole === 'officer' ? department : undefined,
        name: isRegisterMode && fullName ? fullName.trim() : undefined,
        ward: ward.trim(),
      });

      // Redirect dynamically based on logged in role
      if (loggedUser.role === 'admin') {
        navigate('/admin');
      } else if (loggedUser.role === 'officer') {
        navigate('/officer');
      } else {
        navigate('/');
      }
    } catch {
      setAuthError('Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPresetLogin = async (role: UserRole) => {
    setIsLoading(true);
    try {
      const session = await quickLogin(role);
      if (session.role === 'admin') navigate('/admin');
      else if (session.role === 'officer') navigate('/officer');
      else navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  // Color schemes based on role
  const roleStyles = {
    citizen: {
      gradient: 'from-sky-500 via-indigo-600 to-slate-900',
      tabActive: 'bg-sky-600 text-white shadow-md shadow-sky-600/30',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      btnGradient: 'from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500',
      accent: 'text-sky-400',
    },
    officer: {
      gradient: 'from-amber-500 via-orange-600 to-slate-900',
      tabActive: 'bg-amber-600 text-white shadow-md shadow-amber-600/30',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      btnGradient: 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500',
      accent: 'text-amber-400',
    },
    admin: {
      gradient: 'from-slate-900 via-indigo-950 to-slate-950',
      tabActive: 'bg-slate-800 text-white shadow-md shadow-slate-900/50',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      btnGradient: 'from-indigo-600 to-slate-900 hover:from-indigo-500 hover:to-slate-800',
      accent: 'text-indigo-400',
    },
  }[activeRole];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* Left Informational Showcase Column (Large screens) */}
        <div className={`hidden lg:flex lg:col-span-5 bg-gradient-to-br ${roleStyles.gradient} p-8 text-white flex-col justify-between relative overflow-hidden`}>
          {/* Ambient Glow Orbs */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-black/20 blur-2xl pointer-events-none" />

          {/* Top Brand */}
          <div className="relative z-10 space-y-3">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-lg group-hover:scale-105 transition">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="font-black text-xl tracking-tight text-white block">
                  Smart<span className={roleStyles.accent}>Grievance</span>
                </span>
                <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                  City Redressal System
                </span>
              </div>
            </Link>
          </div>

          {/* Dynamic Role Mission Highlight */}
          <div className="relative z-10 space-y-3 my-6">
            {activeRole === 'citizen' && (
              <div className="space-y-3 animate-in fade-in">
                <span className="px-2.5 py-0.5 bg-white/15 backdrop-blur-md text-sky-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-white/10">
                  Citizen Portal
                </span>
                <h2 className="text-xl font-black tracking-tight">
                  Voice, Camera & AI Redressal
                </h2>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">Voice Input</span>
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">GPS Location</span>
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">Live Tracking</span>
                </div>
              </div>
            )}

            {activeRole === 'officer' && (
              <div className="space-y-3 animate-in fade-in">
                <span className="px-2.5 py-0.5 bg-amber-500/20 backdrop-blur-md text-amber-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-amber-400/20">
                  Field Officer Portal
                </span>
                <h2 className="text-xl font-black tracking-tight">
                  Inspection & Resolution
                </h2>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">Assigned Queue</span>
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">Photo Proof</span>
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">Direct Resolution</span>
                </div>
              </div>
            )}

            {activeRole === 'admin' && (
              <div className="space-y-3 animate-in fade-in">
                <span className="px-2.5 py-0.5 bg-indigo-500/20 backdrop-blur-md text-indigo-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-indigo-400/20">
                  Municipal Admin Portal
                </span>
                <h2 className="text-xl font-black tracking-tight">
                  Command & Monitoring
                </h2>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">6 Departments</span>
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">Hotspots</span>
                  <span className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] font-medium border border-white/10">AI Triage</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Note */}
          <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            <span>Secure 256-bit Gov Encryption</span>
            <Link to="/" className="hover:text-white flex items-center gap-1 font-semibold">
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
          </div>
        </div>

        {/* Right Interactive Login Workspace Column */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Role Switcher Tabs */}
            <div className="flex items-center justify-between gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 mb-5">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('citizen');
                  setIsRegisterMode(false);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeRole === 'citizen'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-sky-600" />
                <span>Citizen</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRole('officer');
                  setIsRegisterMode(false);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeRole === 'officer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <span>Officer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRole('admin');
                  setIsRegisterMode(false);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeRole === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Admin</span>
              </button>
            </div>

            {/* Portal Title & Greeting */}
            <div className="space-y-1 mb-5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isRegisterMode ? 'Create Account' : 'Welcome Back'}
              </h1>
              <p className="text-xs text-slate-400">
                {isRegisterMode
                  ? 'Register to lodge and track ward issues.'
                  : 'Enter your credentials to continue.'}
              </p>
            </div>

            {/* Error Notification Alert */}
            {authError && (
              <div className="p-3 mb-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>{authError}</span>
              </div>
            )}

            {/* Quick Demo 1-Click Login Pill */}
            <div className="p-3 mb-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-slate-600 font-semibold">
                  Demo login:
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleQuickPresetLogin(activeRole)}
                disabled={isLoading}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Log in as {activeRole.toUpperCase()}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Main Dynamic Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* If Citizen Register Mode: Name & Ward Input */}
              {isRegisterMode && activeRole === 'citizen' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Full Legal Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rajesh Kumar"
                        className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Residential Ward</label>
                    <select
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    >
                      <option value="Ward 100">Ward 100 (Anna Nagar East)</option>
                      <option value="Ward 101">Ward 101 (Anna Nagar North)</option>
                      <option value="Ward 102">Ward 102 (Anna Nagar West)</option>
                      <option value="Ward 103">Ward 103 (Shenoy Nagar)</option>
                      <option value="Ward 104">Ward 104 (Aminjikarai)</option>
                      <option value="Ward 105">Ward 105 (Arumbakkam)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Identifier Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {activeRole === 'citizen' && (citizenAuthMethod === 'otp' ? 'Mobile Number (10 Digits)' : 'Email or Mobile Number')}
                  {activeRole === 'officer' && 'Officer Employee ID or Official Email'}
                  {activeRole === 'admin' && 'Municipal Executive Email'}
                </label>
                <div className="relative">
                  {activeRole === 'citizen' && citizenAuthMethod === 'otp' ? (
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  ) : (
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  )}
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      activeRole === 'citizen'
                        ? (citizenAuthMethod === 'otp' ? '+91 98401 23456' : 'rajesh.kumar88@example.gov.in')
                        : activeRole === 'officer'
                        ? 'OFF-102 or selvam.roads@smartcity.gov.in'
                        : 'admin.commissioner@smartcity.gov.in'
                    }
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Department Dropdown for Officers */}
              {activeRole === 'officer' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Assigned Municipal Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Department)}
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    {CORE_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Citizen OTP Flow vs Password Flow */}
              {activeRole === 'citizen' && citizenAuthMethod === 'otp' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700">6-Digit Verification Code</label>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isLoading || (otpSent && otpTimer > 0)}
                      className="text-xs font-bold text-sky-600 hover:text-sky-800 disabled:text-slate-400"
                    >
                      {otpSent ? (otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend Code') : 'Send OTP'}
                    </button>
                  </div>

                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter 6-digit OTP (e.g. 742819)"
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold tracking-widest text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  {otpSent && (
                    <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Demo OTP simulated: <strong>742819</strong></span>
                    </p>
                  )}
                </div>
              ) : (
                /* Standard Password / Security PIN Flow */
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      {activeRole === 'admin' ? 'Security Token / Passkey' : 'Password / Security PIN'}
                    </label>
                    {activeRole === 'citizen' && (
                      <button
                        type="button"
                        onClick={() => setCitizenAuthMethod(citizenAuthMethod === 'password' ? 'otp' : 'password')}
                        className="text-[11px] font-bold text-sky-600 hover:underline"
                      >
                        {citizenAuthMethod === 'password' ? 'Use OTP Login instead' : 'Use Password'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder="Enter your security credential..."
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r ${roleStyles.btnGradient} text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-sky-600/20 transition-all duration-200 hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2 cursor-pointer`}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {isRegisterMode
                        ? 'Complete Registration & Sign In'
                        : activeRole === 'admin'
                        ? 'Authenticate Command Access'
                        : activeRole === 'officer'
                        ? 'Sign In to Officer Queue'
                        : 'Sign In to Citizen Portal'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Citizen Register Mode Toggle */}
            {activeRole === 'citizen' && (
              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(!isRegisterMode)}
                  className="text-xs font-bold text-slate-600 hover:text-sky-700 transition"
                >
                  {isRegisterMode
                    ? 'Already have an account? Sign in here'
                    : 'New Resident? Click here to register account'}
                </button>
              </div>
            )}
          </div>

          {/* Bottom Security / Privacy Disclaimers */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>© 2026 Smart City Municipal Corporation</span>
            <div className="flex items-center gap-3">
              <Link to="/track" className="hover:text-slate-600">Track Ticket</Link>
              <span>•</span>
              <Link to="/" className="hover:text-slate-600">Citizen Home</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
