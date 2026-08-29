import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';

import LoginPage from './pages/LoginPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import DocumentsPage from './pages/DocumentsPage';
import DocumentViewer from './pages/DocumentViewer';
import ProjectsPage from './pages/ProjectsPage';
import PaymentsPage from './pages/PaymentsPage';
import UsersPage from './pages/UsersPage';
import AuditLogPage from './pages/AuditLogPage';

// Layout wrapper — only shown when authenticated
function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

// Protected route — redirects to login if not authed
function RequireAuth({ allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their home dashboard
    if (user.role === 'superadmin') return <Navigate to="/superadmin" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

// If already logged in, redirect from /login to dashboard
function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>;
  if (user) {
    if (user.role === 'superadmin') return <Navigate to="/superadmin" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0f1629',
              color: '#F0F4FF',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            },
            success: { iconTheme: { primary: '#22C55E', secondary: '#0f1629' } },
            error:   { iconTheme: { primary: '#EF4444', secondary: '#0f1629' } },
          }}
        />
        <Routes>
          {/* Public */}
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected — all roles */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {/* Super Admin */}
              <Route element={<RequireAuth allowedRoles={['superadmin']} />}>
                <Route path="/superadmin" element={<SuperAdminDashboard />} />
                <Route path="/audit" element={<AuditLogPage />} />
              </Route>

              {/* Admin */}
              <Route element={<RequireAuth allowedRoles={['admin', 'superadmin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>

              {/* Client */}
              <Route element={<RequireAuth allowedRoles={['client']} />}>
                <Route path="/dashboard" element={<ClientDashboard />} />
              </Route>

              {/* Shared (all authenticated) */}
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/:id" element={<DocumentViewer />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route element={<RequireAuth allowedRoles={['admin', 'superadmin']} />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  );
}
