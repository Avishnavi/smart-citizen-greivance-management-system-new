import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { BottomNavigation } from './BottomNavigation';
import { ShieldCheck, Building2 } from 'lucide-react';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-16 lg:pb-0">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Official Government Smart City Citizen Portal Footer */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-12 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2 text-white">
                <Building2 className="w-6 h-6 text-sky-400" />
                <span className="font-extrabold text-lg tracking-tight">
                  Smart City Grievance Management System
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                Citizen-centric e-governance platform powered by AI grievance classification (XLM-RoBERTa), voice-to-text intelligence (Whisper), duplicate detection (SBERT), and automated priority triage (XGBoost) for transparent municipal resolution.
              </p>
              <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
                <ShieldCheck className="w-4 h-4" />
                <span>SSL Encrypted • Unified Grievance Redressal Mechanism</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Citizen Navigation
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/" className="text-slate-400 hover:text-white transition">Citizen Dashboard</Link>
                </li>
                <li>
                  <Link to="/register" className="text-slate-400 hover:text-white transition">Register New Grievance</Link>
                </li>
                <li>
                  <Link to="/track" className="text-slate-400 hover:text-white transition">Live Timeline Tracker</Link>
                </li>
                <li>
                  <Link to="/history" className="text-slate-400 hover:text-white transition">Complaint History & Status</Link>
                </li>
                <li>
                  <Link to="/profile" className="text-slate-400 hover:text-white transition">Citizen Profile & Ward Info</Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                24x7 Emergency Helplines
              </h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center justify-between text-slate-300">
                  <span>Smart City Control:</span>
                  <strong className="text-sky-400">1913</strong>
                </li>
                <li className="flex items-center justify-between text-slate-300">
                  <span>Water & Sewage Crisis:</span>
                  <strong className="text-sky-400">044-4567 4567</strong>
                </li>
                <li className="flex items-center justify-between text-slate-300">
                  <span>Electricity Emergency:</span>
                  <strong className="text-sky-400">1912</strong>
                </li>
                <li className="flex items-center justify-between text-slate-300">
                  <span>Disaster Helpline:</span>
                  <strong className="text-sky-400">1077</strong>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© 2026 Smart City Municipal Corporation. All Citizen Rights Reserved.</p>
            <div className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Citizen Service</span>
              <span>•</span>
              <span>SLA Charter</span>
            </div>
          </div>
        </div>
      </footer>

      <BottomNavigation />
    </div>
  );
};
