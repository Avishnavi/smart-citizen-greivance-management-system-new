import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationDropdown } from './NotificationDropdown';
import {
  Building2,
  PlusCircle,
  Bell,
  Globe,
  User,
  Search,
  History,
  Home as HomeIcon,
  Shield,
  Wrench,
  ChevronDown,
  LogOut,
  LogIn,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { profile, user, isAuthenticated, logout, setLanguage } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const languages = [
    { code: 'English', label: 'English (EN)' },
    { code: 'Tamil', label: 'தமிழ் (TA)' },
    { code: 'Hindi', label: 'हिंदी (HI)' },
    { code: 'Telugu', label: 'తెలుగు (TE)' }
  ];

  const navLinks = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/register', label: 'Report', icon: PlusCircle },
    { to: '/track', label: 'Track', icon: Search },
    { to: '/history', label: 'History', icon: History },
    { to: '/profile', label: 'Profile', icon: User }
  ];

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Portal Title */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25 group-hover:scale-105 transition-all duration-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg">
                Smart<span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">Grievance</span>
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200/60 rounded-md uppercase tracking-wide">
                Citizen
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/60">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-sky-700 shadow-xs border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
                title="Select Preferred Language"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline">{profile.preferredLanguage}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isLangOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLangOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-sky-50 flex items-center justify-between transition ${
                          profile.preferredLanguage === lang.code
                            ? 'text-sky-600 font-bold bg-sky-50/60'
                            : 'text-slate-700'
                        }`}
                      >
                        <span>{lang.label}</span>
                        {profile.preferredLanguage === lang.code && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-slate-100 text-slate-700 transition"
                title="Notifications"
              >
                <Bell className="w-4 h-4 text-slate-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-xs animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
              />
            </div>

            {/* Officer Portal Switcher */}
            <Link
              to="/officer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-300 rounded-xl text-xs font-bold transition shadow-2xs hover:scale-[1.02] active:scale-98"
              title="Go to Department Field Officer Portal"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden lg:inline">Officer Portal</span>
            </Link>

            {/* Admin Portal Switcher */}
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs hover:shadow hover:scale-[1.02] active:scale-98"
              title="Go to Municipal Admin Command Center"
            >
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Admin Command</span>
            </Link>

            {/* User Profile / Login Dropdown */}
            <div className="relative">
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition cursor-pointer"
                  >
                    <img
                      src={user.avatar || profile.avatar}
                      alt={user.name || profile.name}
                      className="w-7 h-7 rounded-xl object-cover ring-2 ring-sky-500/30"
                    />
                    <div className="hidden xl:block text-left">
                      <p className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[85px]">
                        {user.name || profile.name}
                      </p>
                      <p className="text-[9px] text-slate-400 font-semibold truncate capitalize">
                        {user.role} • {user.ward || profile.ward}
                      </p>
                    </div>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {isUserMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in zoom-in-95 text-xs">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="font-extrabold text-slate-900">{user.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-sky-50 text-sky-700 border border-sky-200">
                            {user.role} Session
                          </span>
                        </div>

                        <div className="p-1 space-y-0.5">
                          <Link
                            to="/profile"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold"
                          >
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>My Ward Profile</span>
                          </Link>

                          <Link
                            to="/login"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold"
                          >
                            <Shield className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Switch Role / Portal</span>
                          </Link>

                          <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-bold cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition hover:scale-[1.02] active:scale-98"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
