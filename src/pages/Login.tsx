import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Shield,
  User,
  ArrowRight,
  Lock,
  Mail,
  RefreshCw,
  Home,
  Eye,
  EyeOff,
  Phone,
  MapPin,
  AlertCircle,
  FileText,
  BadgeCheck,
} from 'lucide-react';

export const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, login, registerCitizen, logout } = useAuth();

  // If already authenticated, redirect to role-specific dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === 'central_admin' || user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (
        user.role === 'department_supervisor' ||
        user.role === 'department_employee' ||
        user.role === 'officer'
      ) {
        navigate('/officer', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Determine initial portal: 'citizen' vs 'staff'
  const paramRole = searchParams.get('role');
  const paramPortal = searchParams.get('portal');
  const isInitialStaff =
    paramPortal === 'staff' ||
    ['admin', 'central_admin', 'supervisor', 'department_supervisor', 'employee', 'department_employee', 'officer'].includes(
      paramRole || ''
    );

  const [portal, setPortal] = useState<'citizen' | 'staff'>(isInitialStaff ? 'staff' : 'citizen');

  // Citizen Portal Form States
  const [isCitizenRegister, setIsCitizenRegister] = useState(false);
  const [citizenIdentifier, setCitizenIdentifier] = useState('');
  const [citizenPassword, setCitizenPassword] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [citizenWard, setCitizenWard] = useState('Ward 102');
  const [citizenPhone, setCitizenPhone] = useState('');

  // Staff Portal Form States
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Handle Citizen Login / Registration Submit
  const handleCitizenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    try {
      if (isCitizenRegister) {
        if (!citizenName.trim() || !citizenIdentifier.trim() || !citizenPassword.trim()) {
          setAuthError('Name, email, and password are required for registration.');
          setIsLoading(false);
          return;
        }

        if (citizenPassword.length < 6) {
          setAuthError('Password must be at least 6 characters long.');
          setIsLoading(false);
          return;
        }

        await registerCitizen({
          name: citizenName.trim(),
          email: citizenIdentifier.trim().toLowerCase(),
          password: citizenPassword.trim(),
          ward: citizenWard.trim(),
          phone: citizenPhone.trim() || '+91 98401 23456',
        });
        navigate('/');
        return;
      }

      // Citizen Sign In
      if (!citizenIdentifier.trim() || !citizenPassword.trim()) {
        setAuthError('Please enter your email/mobile and password.');
        setIsLoading(false);
        return;
      }

      await login('citizen', {
        identifier: citizenIdentifier.trim(),
        secret: citizenPassword.trim(),
      });
      navigate('/');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Staff & Official Login Submit
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!staffIdentifier.trim() || !staffPassword.trim()) {
      setAuthError('Official identifier and password are required.');
      return;
    }

    setIsLoading(true);

    try {
      const loggedUser = await login('officer', {
        identifier: staffIdentifier.trim(),
        secret: staffPassword.trim(),
      });

      // Strict enforcement: Citizen accounts cannot log into the Department Staff Portal
      if (loggedUser.role === 'citizen') {
        logout();
        setAuthError(
          'Access Restricted: This account has citizen privileges. Please use the Citizen Portal.'
        );
        setIsLoading(false);
        return;
      }

      // Route to appropriate official dashboard
      if (loggedUser.role === 'central_admin' || loggedUser.role === 'admin') {
        navigate('/admin');
      } else if (
        loggedUser.role === 'department_supervisor' ||
        loggedUser.role === 'department_employee' ||
        loggedUser.role === 'officer'
      ) {
        navigate('/officer');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Staff authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* ==================================================== */}
        {/* LEFT COLUMN: BRAND & SHOWCASE                       */}
        {/* ==================================================== */}
        <div
          className={`hidden lg:flex lg:col-span-5 p-8 text-white flex-col justify-between relative overflow-hidden transition-all duration-300 ${
            portal === 'citizen'
              ? 'bg-gradient-to-br from-sky-600 via-indigo-700 to-slate-950'
              : 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950'
          }`}
        >
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-black/20 blur-2xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10 space-y-3">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-lg group-hover:scale-105 transition">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="font-black text-xl tracking-tight text-white block">
                  Smart<span className={portal === 'citizen' ? 'text-sky-300' : 'text-indigo-400'}>Grievance</span>
                </span>
                <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                  City Municipal Corporation
                </span>
              </div>
            </Link>
          </div>

          {/* Dynamic Mission Content */}
          <div className="relative z-10 space-y-4 my-6">
            {portal === 'citizen' ? (
              <div className="space-y-3 animate-in fade-in">
                <span className="px-2.5 py-0.5 bg-white/15 backdrop-blur-md text-sky-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-white/10">
                  Citizen Grievance Redressal
                </span>
                <h2 className="text-2xl font-black tracking-tight leading-tight">
                  Lodge, Monitor & Verify Civic Complaints
                </h2>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Submit grievances via text, camera capture, or voice recording. Our automated AI orchestrator classifies categories, predicts priority scores, and routes directly to the municipal department.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[11px] font-semibold border border-white/10 flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-sky-300" /> Multi-Modal Grievance
                  </span>
                  <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[11px] font-semibold border border-white/10 flex items-center gap-1.5">
                    <BadgeCheck className="w-3 h-3 text-emerald-300" /> Resolution Verification
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in">
                <span className="px-2.5 py-0.5 bg-indigo-500/30 backdrop-blur-md text-indigo-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-indigo-400/30">
                  Municipal Staff & Command
                </span>
                <h2 className="text-2xl font-black tracking-tight leading-tight">
                  Department Operations & Central Administration
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Authorized access for Central Command Leads, Department Supervisors, and Field Crews to inspect complaints, assign work orders, update task progress, and submit resolution proof.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[11px] font-semibold border border-white/10 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-indigo-300" /> Central Admin Command
                  </span>
                  <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[11px] font-semibold border border-white/10 flex items-center gap-1.5">
                    <BadgeCheck className="w-3 h-3 text-amber-300" /> Department Supervision
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Badge */}
          <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            <span>RBAC Secured • JWT + bcrypt</span>
            <Link to="/" className="hover:text-white flex items-center gap-1 font-semibold">
              <Home className="w-3.5 h-3.5" />
              <span>Public Portal</span>
            </Link>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: INTERACTIVE AUTH WORKSPACE             */}
        {/* ==================================================== */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* 2-Portal Segmented Switcher */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 mb-6">
              <button
                type="button"
                onClick={() => {
                  setPortal('citizen');
                  setAuthError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  portal === 'citizen'
                    ? 'bg-white text-sky-800 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4 text-sky-600" />
                <span>Citizen Portal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPortal('staff');
                  setAuthError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  portal === 'staff'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Department Staff & Admin</span>
              </button>
            </div>

            {/* Error Notification Alert */}
            {authError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* ==================================================== */}
            {/* VIEW A: CITIZEN PORTAL (LOGIN OR REGISTER)           */}
            {/* ==================================================== */}
            {portal === 'citizen' && (
              <div className="space-y-4">
                {/* Citizen Header & Mode Switcher */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {isCitizenRegister ? 'Citizen Registration' : 'Citizen Sign In'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isCitizenRegister
                        ? 'Create your resident profile to report and track municipal grievances.'
                        : 'Access your submitted complaints and view live resolution updates.'}
                    </p>
                  </div>

                  {/* Sign In vs Register Toggle Pills */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCitizenRegister(false);
                        setAuthError(null);
                      }}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        !isCitizenRegister
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCitizenRegister(true);
                        setAuthError(null);
                      }}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        isCitizenRegister
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Register
                    </button>
                  </div>
                </div>

                {/* Citizen Form */}
                <form onSubmit={handleCitizenSubmit} className="space-y-4 text-xs">
                  {/* Register-only: Full Legal Name */}
                  {isCitizenRegister && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full Legal Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={citizenName}
                          onChange={(e) => setCitizenName(e.target.value)}
                          placeholder="e.g. Rajesh Kumar"
                          className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email / Identifier */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isCitizenRegister ? 'Email Address' : 'Email Address or Mobile Number'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={citizenIdentifier}
                        onChange={(e) => setCitizenIdentifier(e.target.value)}
                        placeholder="e.g. citizen@example.gov.in"
                        className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Register-only: Ward and Phone */}
                  {isCitizenRegister && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Residential Ward</label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <select
                            value={citizenWard}
                            onChange={(e) => setCitizenWard(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Mobile Contact</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={citizenPhone}
                            onChange={(e) => setCitizenPhone(e.target.value)}
                            placeholder="+91 98401 23456"
                            className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={citizenPassword}
                        onChange={(e) => setCitizenPassword(e.target.value)}
                        placeholder={isCitizenRegister ? 'Create a secure password (min 6 chars)' : 'Enter your password'}
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

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-sky-600/20 transition-all duration-200 hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>{isCitizenRegister ? 'Complete Registration & Sign In' : 'Sign In as Citizen'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Bottom Switcher Note */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPortal('staff');
                      setAuthError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-indigo-600 font-semibold transition"
                  >
                    Municipal Supervisor, Field Officer, or Admin?{' '}
                    <span className="font-bold underline text-indigo-700">Access Department Staff Login →</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* VIEW B: DEPARTMENT STAFF & ADMIN PORTAL              */}
            {/* ==================================================== */}
            {portal === 'staff' && (
              <div className="space-y-4">
                {/* Staff Header */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-white">
                      Official Access
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Staff & Administration
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Municipal Staff Login
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sign in with your official municipal credentials. For Central Admin, Supervisors, and Field Crew.
                  </p>
                </div>

                {/* Official Provisioning Notice */}
                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    <span>Controlled Staff Provisioning</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Public registration for department staff is strictly disabled. Department Supervisors and Employees are provisioned directly by the Central Administration.
                  </p>
                </div>

                {/* Staff Form */}
                <form onSubmit={handleStaffSubmit} className="space-y-4 text-xs">
                  {/* Official Identifier */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Official Email Address or Employee ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={staffIdentifier}
                        onChange={(e) => setStaffIdentifier(e.target.value)}
                        placeholder="e.g. OFF-1021 or staff@smartcity.gov.in"
                        className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Security Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="Enter your official staff password"
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-900 hover:from-slate-800 hover:to-indigo-800 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-indigo-950/20 transition-all duration-200 hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Authenticate Municipal Access</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Return to Citizen Portal */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPortal('citizen');
                      setAuthError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-sky-600 font-semibold transition"
                  >
                    Resident citizen lodging or tracking a grievance?{' '}
                    <span className="font-bold underline text-sky-700">Return to Citizen Portal →</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Info */}
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
