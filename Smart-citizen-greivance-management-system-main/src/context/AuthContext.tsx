import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CitizenProfile, UserRole, UserSession, Department } from '../types';

export const DEMO_CITIZEN: UserSession = {
  id: 'CIT-8842',
  name: 'Rajesh Kumar',
  email: 'rajesh.kumar88@example.gov.in',
  phone: '+91 98401 23456',
  role: 'citizen',
  ward: 'Ward 102',
  zone: 'Zone 8 (Anna Nagar)',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  preferredLanguage: 'English',
};

export const DEMO_OFFICER: UserSession = {
  id: 'OFF-102',
  name: 'Er. S. Selvam',
  email: 'selvam.roads@smartcity.gov.in',
  phone: '+91 98402 11223',
  role: 'officer',
  department: 'Roads & Bridges',
  ward: 'Ward 102',
  zone: 'Zone 8 (Anna Nagar)',
  designation: 'Assistant Executive Engineer',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  preferredLanguage: 'English',
};

export const DEMO_ADMIN: UserSession = {
  id: 'ADM-001',
  name: 'Dr. K. Radhakrishnan, IAS',
  email: 'admin.commissioner@smartcity.gov.in',
  phone: '+91 98400 00001',
  role: 'admin',
  zone: 'Greater Chennai Municipal Corporation',
  designation: 'Municipal Commissioner / City Command Lead',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  preferredLanguage: 'English',
};

const INITIAL_CITIZEN_PROFILE: CitizenProfile = {
  id: 'CIT-8842',
  name: 'Rajesh Kumar',
  email: 'rajesh.kumar88@example.gov.in',
  phone: '+91 98401 23456',
  address: 'No. 42, 3rd Main Road, Anna Nagar West',
  ward: 'Ward 102',
  zone: 'Zone 8 (Anna Nagar)',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  preferredLanguage: 'English',
  notificationPreferences: {
    sms: true,
    email: true,
    whatsapp: true,
    push: true,
  },
};

const SESSION_STORAGE_KEY = 'smart_city_active_session_v2';
const PROFILE_STORAGE_KEY = 'smart_city_citizen_profile_v2';

interface LoginCredentials {
  identifier: string; // Email or Mobile Number or Officer ID
  secret?: string; // Password or OTP
  department?: Department;
  name?: string;
  ward?: string;
}

interface AuthContextType {
  user: UserSession;
  profile: CitizenProfile;
  role: UserRole;
  isAuthenticated: boolean;
  login: (role: UserRole, credentials: LoginCredentials) => Promise<UserSession>;
  quickLogin: (presetRole: UserRole) => Promise<UserSession>;
  logout: () => void;
  updateProfile: (updated: Partial<CitizenProfile>) => void;
  setLanguage: (lang: string) => void;
  resetProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEMO_CITIZEN;
  });

  const [profile, setProfile] = useState<CitizenProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_CITIZEN_PROFILE;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem(SESSION_STORAGE_KEY));
  });

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const login = async (selectedRole: UserRole, credentials: LoginCredentials): Promise<UserSession> => {
    // Dynamic login handler
    let sessionUser: UserSession;

    if (selectedRole === 'admin') {
      sessionUser = {
        ...DEMO_ADMIN,
        email: credentials.identifier || DEMO_ADMIN.email,
        name: credentials.name || DEMO_ADMIN.name,
      };
    } else if (selectedRole === 'officer') {
      sessionUser = {
        ...DEMO_OFFICER,
        id: credentials.identifier.startsWith('OFF') ? credentials.identifier : `OFF-${Math.floor(100 + Math.random() * 900)}`,
        name: credentials.name || 'Field Officer',
        email: credentials.identifier.includes('@') ? credentials.identifier : `${credentials.identifier.toLowerCase()}@smartcity.gov.in`,
        department: credentials.department || 'Roads & Bridges',
      };
    } else {
      // Citizen
      const isPhone = /^\+?[0-9\s-]{8,15}$/.test(credentials.identifier);
      sessionUser = {
        ...DEMO_CITIZEN,
        id: `CIT-${Math.floor(1000 + Math.random() * 9000)}`,
        name: credentials.name || (isPhone ? 'Citizen Resident' : credentials.identifier.split('@')[0]),
        email: isPhone ? `${credentials.identifier.replace(/\D/g, '')}@citizen.gov.in` : credentials.identifier,
        phone: isPhone ? credentials.identifier : '+91 98401 23456',
        ward: credentials.ward || 'Ward 102',
      };

      setProfile((prev) => ({
        ...prev,
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        phone: sessionUser.phone || prev.phone,
        ward: sessionUser.ward || prev.ward,
      }));
    }

    setUser(sessionUser);
    setIsAuthenticated(true);
    return sessionUser;
  };

  const quickLogin = async (presetRole: UserRole): Promise<UserSession> => {
    let sessionUser: UserSession;
    if (presetRole === 'admin') sessionUser = DEMO_ADMIN;
    else if (presetRole === 'officer') sessionUser = DEMO_OFFICER;
    else sessionUser = DEMO_CITIZEN;

    setUser(sessionUser);
    setIsAuthenticated(true);

    if (presetRole === 'citizen') {
      setProfile(INITIAL_CITIZEN_PROFILE);
    }
    return sessionUser;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setUser(DEMO_CITIZEN);
  };

  const updateProfile = (updated: Partial<CitizenProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updated };
      setUser((u) => ({
        ...u,
        name: next.name,
        email: next.email,
        phone: next.phone,
        ward: next.ward,
        zone: next.zone,
        avatar: next.avatar,
      }));
      return next;
    });
  };

  const setLanguage = (preferredLanguage: string) => {
    setProfile((prev) => ({ ...prev, preferredLanguage }));
    setUser((prev) => ({ ...prev, preferredLanguage }));
  };

  const resetProfile = () => {
    setProfile(INITIAL_CITIZEN_PROFILE);
    setUser(DEMO_CITIZEN);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(INITIAL_CITIZEN_PROFILE));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: user.role,
        isAuthenticated,
        login,
        quickLogin,
        logout,
        updateProfile,
        setLanguage,
        resetProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
