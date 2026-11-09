import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CitizenProfile, UserRole, UserSession, Department } from '../types';
import { fetchApi, getAuthToken, setAuthToken } from '../services/api';

export const EMPTY_CITIZEN_PROFILE: CitizenProfile = {
  id: '',
  name: '',
  email: '',
  phone: '',
  address: '',
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

export function buildCitizenProfile(u: any, p?: any): CitizenProfile {
  if (!u) return EMPTY_CITIZEN_PROFILE;
  return {
    id: u.citizenId || u.id || u._id || '',
    name: u.name || 'Citizen',
    email: u.email || '',
    phone: u.phone || p?.phone || '',
    address: p?.address || (u.ward ? `${u.ward}, ${u.zone || 'Chennai'}` : ''),
    ward: u.ward || p?.ward || 'Ward 102',
    zone: u.zone || p?.zone || 'Zone 8 (Anna Nagar)',
    avatar: u.avatar || p?.avatar || EMPTY_CITIZEN_PROFILE.avatar,
    preferredLanguage: u.preferredLanguage || p?.preferredLanguage || 'English',
    notificationPreferences: p?.notificationPreferences || {
      sms: true,
      email: true,
      whatsapp: true,
      push: true,
    },
  };
}

const SESSION_STORAGE_KEY = 'smart_city_active_session_v2';
const PROFILE_STORAGE_KEY = 'smart_city_citizen_profile_v2';

export interface LoginCredentials {
  identifier: string; // Email or Mobile Number or Officer ID
  secret?: string; // Password
  password?: string;
  department?: Department;
  name?: string;
  ward?: string;
}

export interface RegisterCitizenInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  ward?: string;
  zone?: string;
  address?: string;
  preferredLanguage?: string;
}

interface AuthContextType {
  user: UserSession | null;
  profile: CitizenProfile;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (role: UserRole, credentials: LoginCredentials) => Promise<UserSession>;
  registerCitizen: (data: RegisterCitizenInput) => Promise<UserSession>;
  quickLogin: (presetRole: UserRole) => Promise<UserSession>;
  logout: () => void;
  updateProfile: (updated: Partial<CitizenProfile>) => void;
  setLanguage: (lang: string) => void;
  resetProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const token = getAuthToken();
      if (!token) return null;
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [profile, setProfile] = useState<CitizenProfile>(() => {
    try {
      const token = getAuthToken();
      if (!token) return EMPTY_CITIZEN_PROFILE;
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return EMPTY_CITIZEN_PROFILE;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getAuthToken());
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from backend on mount if JWT exists
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsAuthenticated(false);
      setUser(null);
      setProfile(EMPTY_CITIZEN_PROFILE);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      setIsLoading(false);
      return;
    }

    fetchApi<{ user: any; profile?: any }>('/auth/me')
      .then((res) => {
        if (res && res.user) {
          const u = res.user;
          const sessionUser: UserSession = {
            id: u.id || u._id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            departmentId: u.departmentId,
            departmentName: u.departmentName,
            department: u.departmentName as Department,
            ward: u.ward,
            zone: u.zone,
            avatar: u.avatar || EMPTY_CITIZEN_PROFILE.avatar,
            designation: u.designation,
            citizenId: u.citizenId,
            employeeId: u.employeeId,
          };
          setUser(sessionUser);
          setIsAuthenticated(true);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));

          const built = buildCitizenProfile(sessionUser, res.profile);
          setProfile(built);
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(built));
        } else {
          setAuthToken(null);
          setIsAuthenticated(false);
          setUser(null);
          setProfile(EMPTY_CITIZEN_PROFILE);
        }
      })
      .catch((err) => {
        console.warn('Session verification failed on mount:', err);
        setAuthToken(null);
        setIsAuthenticated(false);
        setUser(null);
        setProfile(EMPTY_CITIZEN_PROFILE);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    if (user && profile.name) {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    }
  }, [profile, user]);

  // Actual backend login
  const login = async (
    _selectedRole: UserRole,
    credentials: LoginCredentials
  ): Promise<UserSession> => {
    const password = credentials.secret || credentials.password || 'Citizen@123';

    try {
      const res = await fetchApi<{ token: string; user: any; profile?: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: credentials.identifier,
          email: credentials.identifier,
          password,
        }),
      });

      if (res && res.token && res.user) {
        setAuthToken(res.token);
        const u = res.user;
        const sessionUser: UserSession = {
          id: u.id || u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          departmentId: u.departmentId,
          departmentName: u.departmentName,
          department: u.departmentName as Department,
          ward: u.ward,
          zone: u.zone,
          avatar: u.avatar || EMPTY_CITIZEN_PROFILE.avatar,
          designation: u.designation,
          citizenId: u.citizenId,
          employeeId: u.employeeId,
        };

        setUser(sessionUser);
        setIsAuthenticated(true);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));

        const built = buildCitizenProfile(sessionUser, res.profile);
        setProfile(built);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(built));

        return sessionUser;
      }
    } catch (err: any) {
      console.warn('Backend login request error:', err.message);
      throw err;
    }

    throw new Error('Login failed. Please check credentials.');
  };

  // Register citizen via backend API
  const registerCitizen = async (data: RegisterCitizenInput): Promise<UserSession> => {
    const res = await fetchApi<{ token: string; user: any; profile?: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        role: 'citizen',
      }),
    });

    if (res && res.token && res.user) {
      setAuthToken(res.token);
      const u = res.user;
      const sessionUser: UserSession = {
        id: u.id || u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: 'citizen',
        citizenId: u.citizenId,
        ward: u.ward,
        zone: u.zone,
        avatar: EMPTY_CITIZEN_PROFILE.avatar,
      };

      setUser(sessionUser);
      setIsAuthenticated(true);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));

      const built = buildCitizenProfile(sessionUser, res.profile);
      setProfile(built);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(built));
      return sessionUser;
    }

    throw new Error('Registration failed.');
  };

  // Quick login for demonstrations with real backend credentials
  const quickLogin = async (presetRole: UserRole): Promise<UserSession> => {
    let email = 'rajesh.kumar88@example.gov.in';
    let password = 'Citizen@123';

    if (presetRole === 'central_admin' || presetRole === 'admin') {
      email = 'admin.commissioner@smartcity.gov.in';
      password = 'Admin@123';
    } else if (presetRole === 'department_supervisor' || presetRole === 'officer') {
      email = 'selvam.supervisor@smartcity.gov.in';
      password = 'Supervisor@123';
    } else if (presetRole === 'department_employee') {
      email = 'ramesh.field@smartcity.gov.in';
      password = 'Employee@123';
    }

    return login(presetRole, { identifier: email, secret: password });
  };

  const logout = () => {
    fetchApi('/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthToken(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setProfile(EMPTY_CITIZEN_PROFILE);
  };

  const updateProfile = (updated: Partial<CitizenProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updated };
      setUser((u) => {
        if (!u) return null;
        return {
          ...u,
          name: next.name,
          email: next.email,
          phone: next.phone,
          ward: next.ward,
          zone: next.zone,
          avatar: next.avatar,
        };
      });
      return next;
    });
  };

  const setLanguage = (preferredLanguage: string) => {
    setProfile((prev) => ({ ...prev, preferredLanguage }));
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, preferredLanguage };
    });
  };

  const resetProfile = () => {
    if (user) {
      const reset = buildCitizenProfile(user);
      setProfile(reset);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(reset));
    } else {
      setProfile(EMPTY_CITIZEN_PROFILE);
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: user ? user.role : null,
        isAuthenticated,
        isLoading,
        login,
        registerCitizen,
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
