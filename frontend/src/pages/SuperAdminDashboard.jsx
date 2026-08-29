import { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/api';
import Navbar from '../components/Navbar';
import StatsCard from '../components/StatsCard';
import { Users, FileText, FolderKanban, CreditCard, ShieldCheck, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar title="Super Admin Dashboard" subtitle="Full system overview" />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>System Overview</h1>
            <p>Monitor all admins, clients, and activity across the platform.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: '2rem' }}>
              <StatsCard icon={Users} label="Total Admins" value={stats?.total_admins} color="blue" />
              <StatsCard icon={Users} label="Total Clients" value={stats?.total_clients} color="teal" />
              <StatsCard icon={FileText} label="Total Documents" value={stats?.total_documents} color="purple" />
              <StatsCard icon={ShieldCheck} label="Signed Documents" value={stats?.total_signed} color="green" />
              <StatsCard icon={FolderKanban} label="Total Projects" value={stats?.total_projects} color="amber" />
              <StatsCard icon={CreditCard} label="Pending Payments" value={stats?.pending_payments} color="red" />
            </div>

            <div className="grid-2">
              {/* Quick actions */}
              <div className="card card-body">
                <h3 style={{ marginBottom: '1rem' }}>Quick Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { label: 'Manage Users', to: '/users', color: 'var(--accent-blue)' },
                    { label: 'View All Documents', to: '/documents', color: 'var(--accent-purple)' },
                    { label: 'Monitor Projects', to: '/projects', color: 'var(--accent-teal)' },
                    { label: 'View Payments', to: '/payments', color: 'var(--accent-green)' },
                    { label: 'Audit Logs', to: '/audit', color: 'var(--accent-amber)' },
                  ].map(item => (
                    <a key={item.to} href={item.to} className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* System info */}
              <div className="card card-body">
                <h3 style={{ marginBottom: '1rem' }}>Platform Health</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { label: 'Backend API', status: 'Online', color: 'var(--accent-green)' },
                    { label: 'Database', status: 'Connected', color: 'var(--accent-green)' },
                    { label: 'Storage', status: 'Active', color: 'var(--accent-green)' },
                    { label: 'Stripe Payments', status: 'Test Mode', color: 'var(--accent-amber)' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem' }}>{item.label}</span>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        fontSize: '0.8rem', fontWeight: 600, color: item.color
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color }} />
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
