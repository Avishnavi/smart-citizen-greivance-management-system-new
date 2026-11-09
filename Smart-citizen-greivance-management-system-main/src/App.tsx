import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ComplaintProvider } from './context/ComplaintContext';
import { AppLayout } from './components/layout/AppLayout';
import type { UserRole } from './types';

// Pages
import { Home } from './pages/Home';
import { RegisterComplaint } from './pages/RegisterComplaint';
import { TrackComplaint } from './pages/TrackComplaint';
import { ComplaintHistory } from './pages/ComplaintHistory';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/AdminDashboard';
import { DepartmentOfficerDashboard } from './pages/DepartmentOfficerDashboard';
import { Login } from './pages/Login';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'central_admin' || user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (
      user.role === 'department_supervisor' ||
      user.role === 'department_employee' ||
      user.role === 'officer'
    ) {
      return <Navigate to="/officer" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ComplaintProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['central_admin', 'admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer"
                element={
                  <ProtectedRoute allowedRoles={['department_supervisor', 'department_employee', 'officer']}>
                    <DepartmentOfficerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<AppLayout />}>
                <Route
                  index
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="register"
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <RegisterComplaint />
                    </ProtectedRoute>
                  }
                />
                <Route path="track" element={<TrackComplaint />} />
                <Route
                  path="history"
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <ComplaintHistory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </ComplaintProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
