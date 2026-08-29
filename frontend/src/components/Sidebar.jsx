import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, FolderKanban, CreditCard,
  Users, ShieldCheck, LogOut, Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import toast from 'react-hot-toast';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';

const NAV = {
  superadmin: [
    { label: 'Overview', section: 'Dashboard' },
    { to: '/superadmin', icon: LayoutDashboard, label: 'Dashboard' },
    { label: 'Management', section: true },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/documents', icon: FileText, label: 'Documents' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/payments', icon: CreditCard, label: 'Payments' },
    { label: 'System', section: true },
    { to: '/audit', icon: ShieldCheck, label: 'Audit Logs' },
  ],
  admin: [
    { label: 'Overview', section: true },
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { label: 'Management', section: true },
    { to: '/users', icon: Users, label: 'Clients' },
    { to: '/documents', icon: FileText, label: 'Documents' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/payments', icon: CreditCard, label: 'Payments' },
  ],
  client: [
    { label: 'Overview', section: true },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { label: 'My Portal', section: true },
    { to: '/documents', icon: FileText, label: 'Documents' },
    { to: '/projects', icon: FolderKanban, label: 'My Projects' },
    { to: '/payments', icon: CreditCard, label: 'Payments' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isOpen, closeSidebar } = useSidebar();
  const navigate = useNavigate();
  const navItems = NAV[user?.role] || [];

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={closeSidebar}
        />
      )}
      
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo" style={{ padding: '1rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <BrandLogo size="md" />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item, i) =>
            item.section ? (
              <span key={i} className="nav-section-label">{item.label}</span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/superadmin' || item.to === '/admin' || item.to === '/dashboard'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={closeSidebar}
              >
                <item.icon size={18} className="nav-link-icon" />
                {item.label}
              </NavLink>
            )
          )}
        </nav>

      {/* User + Logout */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div className="user-pill" style={{ flex: 1, marginRight: '0.5rem', marginBottom: 0 }}>
            <div className="user-avatar">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="user-pill-info">
              <div className="user-pill-name truncate">{user?.name}</div>
              <div className="user-pill-role">{user?.role}</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <button
          className="btn btn-ghost w-full"
          onClick={handleLogout}
          style={{ justifyContent: 'flex-start' }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
    </>
  );
}
