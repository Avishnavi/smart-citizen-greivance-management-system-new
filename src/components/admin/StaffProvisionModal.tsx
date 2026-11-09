import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import {
  X,
  Shield,
  UserPlus,
  Building2,
  Mail,
  Lock,
  Phone,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

interface StaffProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (provisionedUser: any) => void;
}

const DEFAULT_DEPARTMENTS = [
  'Road Maintenance Department',
  'Water & Sewerage Board',
  'Electricity & Lighting Department',
  'Solid Waste Management',
  'Traffic & Transport Department',
  'Public Health & Sanitation',
  'Town Planning & Enforcement',
  'Horticulture & Parks',
];

export const StaffProvisionModal: React.FC<StaffProvisionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [role, setRole] = useState<'department_supervisor' | 'department_employee'>('department_employee');
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [selectedDept, setSelectedDept] = useState<string>(DEFAULT_DEPARTMENTS[0]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('Field Officer');
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Load live departments from backend
  useEffect(() => {
    if (isOpen) {
      fetchApi<{ data: Array<{ name: string }> }>('/departments')
        .then((res) => {
          if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
            const names = res.data.map((d) => d.name);
            setDepartments(names);
            if (!names.includes(selectedDept)) {
              setSelectedDept(names[0]);
            }
          }
        })
        .catch(() => {
          // Use default fallback
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Full name, official email, and password are required.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Initial password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetchApi<{ success: boolean; message: string; user: any }>('/auth/provision-staff', {
        method: 'POST',
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          role,
          departmentName: selectedDept,
          designation: designation.trim() || (role === 'department_supervisor' ? 'Department Supervisor' : 'Field Officer'),
          phone: phone.trim(),
        }),
      });

      if (res && res.user) {
        setSuccessData(res.user);
        if (onSuccess) onSuccess(res.user);
      } else {
        throw new Error('Provisioning failed. No user details returned.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to provision staff member. Verify administrator permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setErrorMsg(null);
  };

  const copyCredentials = () => {
    if (!successData) return;
    const credText = `Smart City Staff Account:
Name: ${successData.name}
Role: ${successData.role}
Employee ID: ${successData.employeeId}
Department: ${successData.departmentName}
Official Email: ${successData.email}
Initial Password: ${password}`;

    navigator.clipboard.writeText(credText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <UserPlus className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white">
                Provision Department Staff
              </h2>
              <p className="text-[11px] text-slate-300">
                Controlled staff onboarding by Central Administration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {successData ? (
            /* Success Confirmation Card */
            <div className="space-y-4 animate-in zoom-in-95">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-emerald-950">
                    Staff Account Provisioned Successfully
                  </h3>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    The account has been created in the database with hashed security credentials. The staff member can now log in via the Department Staff Portal.
                  </p>
                </div>
              </div>

              {/* Account Credentials Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Assigned Employee ID:</span>
                  <span className="font-black text-slate-900 text-sm px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg">
                    {successData.employeeId}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Full Name:</span>
                  <span className="font-bold text-slate-800">{successData.name}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Assigned Role:</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {successData.role.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Department:</span>
                  <span className="font-bold text-slate-800">{successData.departmentName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Official Email:</span>
                  <span className="font-bold text-slate-800">{successData.email}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 font-semibold">Initial Password:</span>
                  <span className="font-mono font-bold text-slate-900">{password}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold text-xs text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Copied Details</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy Credentials</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Provision Another
                </button>
              </div>
            </div>
          ) : (
            /* Provisioning Form */
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Role Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Role Assignment <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('department_supervisor');
                      if (designation === 'Field Officer') setDesignation('Department Supervisor');
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      role === 'department_supervisor'
                        ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black">Supervisor</div>
                      <div className="text-[10px] text-slate-500 font-normal">Department queue & task dispatch</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('department_employee');
                      if (designation === 'Department Supervisor') setDesignation('Field Officer');
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      role === 'department_employee'
                        ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black">Field Employee</div>
                      <div className="text-[10px] text-slate-500 font-normal">Task execution & resolution proof</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Assigned Department <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Full Name & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Staff Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. S. Murugan"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Road Inspector"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Official Email */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. murugan.roads@smartcity.gov.in"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Initial Password & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Initial Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Official Mobile Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98401 55667"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs text-slate-600 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-900 hover:from-slate-800 hover:to-indigo-800 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Provision Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

