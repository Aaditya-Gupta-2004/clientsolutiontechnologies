import { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/api';
import Navbar from '../components/Navbar';
import StatsCard from '../components/StatsCard';
import { Users, FileText, FolderKanban, CreditCard, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
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
      <Navbar title="Admin Dashboard" subtitle="Your workspace overview" />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Admin Dashboard</h1>
            <p>Manage your clients, documents, projects, and payments.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a href="/users" className="btn btn-secondary"><Users size={16} /> Add Client</a>
            <a href="/documents" className="btn btn-primary"><FileText size={16} /> New Document</a>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: '2rem' }}>
              <StatsCard icon={Users} label="My Clients" value={stats?.my_clients} color="blue" />
              <StatsCard icon={FileText} label="Documents Sent" value={stats?.pending_documents} color="purple" subtitle="Awaiting signature" />
              <StatsCard icon={CheckCircle} label="Signed Docs" value={stats?.signed_documents} color="green" />
              <StatsCard icon={FolderKanban} label="Active Projects" value={stats?.active_projects} color="teal" />
              <StatsCard icon={CreditCard} label="Pending Payments" value={stats?.pending_payments} color="amber" />
              <StatsCard
                icon={CreditCard} label="Revenue Collected"
                value={`$${(stats?.collected_revenue || 0).toFixed(2)}`}
                color="green"
              />
            </div>

            <div className="grid-2">
              <div className="card card-body">
                <h3 style={{ marginBottom: '1rem' }}>Quick Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <a href="/documents" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    <FileText size={16} /> Upload & Send Document
                  </a>
                  <a href="/projects" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    <FolderKanban size={16} /> Create Project
                  </a>
                  <a href="/payments" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    <CreditCard size={16} /> Create Payment Request
                  </a>
                  <a href="/users" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    <Users size={16} /> Add New Client
                  </a>
                </div>
              </div>

              <div className="card card-body">
                <h3 style={{ marginBottom: '1rem' }}>Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {[
                    { label: 'Total documents', value: stats?.total_documents },
                    { label: 'Total projects', value: stats?.total_projects },
                    { label: 'Total payments', value: stats?.total_payments },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span style={{ fontWeight: 700 }}>{item.value ?? 0}</span>
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
