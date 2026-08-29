import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { Bell, Menu } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ title, subtitle }) {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();

  return (
    <header className="navbar">
      <div className="navbar-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          className="btn btn-icon btn-ghost mobile-menu-btn" 
          onClick={toggleSidebar}
          aria-label="Toggle Menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <div className="page-title">{title || 'Dashboard'}</div>
          {subtitle && <div className="page-breadcrumb">{subtitle}</div>}
        </div>
      </div>
      <div className="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ThemeToggle />
        <button className="btn btn-icon btn-ghost" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <div className="user-pill" style={{ cursor: 'default' }}>
          <div className="user-avatar" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user?.name}</span>
        </div>
      </div>
    </header>
  );
}
