import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ComplaintProvider } from './context/ComplaintContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { Home } from './pages/Home';
import { RegisterComplaint } from './pages/RegisterComplaint';
import { TrackComplaint } from './pages/TrackComplaint';
import { ComplaintHistory } from './pages/ComplaintHistory';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/AdminDashboard';
import { DepartmentOfficerDashboard } from './pages/DepartmentOfficerDashboard';
import { Login } from './pages/Login';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ComplaintProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/officer" element={<DepartmentOfficerDashboard />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Home />} />
                <Route path="register" element={<RegisterComplaint />} />
                <Route path="track" element={<TrackComplaint />} />
                <Route path="history" element={<ComplaintHistory />} />
                <Route path="profile" element={<Profile />} />
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
