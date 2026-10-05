import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PlusCircle, Search, History, User } from 'lucide-react';

export const BottomNavigation: React.FC = () => {
  const tabs = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/register', label: 'Register', icon: PlusCircle, isPrimary: true },
    { to: '/track', label: 'Track', icon: Search },
    { to: '/history', label: 'History', icon: History },
    { to: '/profile', label: 'Profile', icon: User }
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg safe-area-pb">
      <nav className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[11px] font-medium transition-all ${
                  tab.isPrimary
                    ? isActive
                      ? 'text-sky-600 font-bold scale-105'
                      : 'text-sky-600 font-semibold'
                    : isActive
                    ? 'text-sky-600 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-xl transition ${
                      tab.isPrimary
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                        : isActive
                        ? 'bg-sky-50 text-sky-600'
                        : 'text-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="mt-0.5">{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
