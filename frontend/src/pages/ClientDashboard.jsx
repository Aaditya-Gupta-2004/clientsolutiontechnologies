import { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/api';
import Navbar from '../components/Navbar';
import StatsCard from '../components/StatsCard';
import ProjectProgressCard from '../components/ProjectProgressCard';
import { FileText, FolderKanban, CreditCard, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientDashboard() {
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
      <Navbar title="My Dashboard" subtitle="Your project and document portal" />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>My Dashboard</h1>
            <p>Track your projects, sign documents, and manage payments.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: '2rem' }}>
              <StatsCard icon={FileText} label="Pending Signatures" value={stats?.documents_to_sign} color="amber" subtitle="Action required" />
              <StatsCard icon={CheckCircle} label="Signed Documents" value={stats?.signed_documents} color="green" />
              <StatsCard icon={FolderKanban} label="Active Projects" value={stats?.active_projects} color="blue" />
              <StatsCard icon={CreditCard} label="Pending Payments" value={stats?.pending_payments} color="red" subtitle="Action required" />
            </div>

            {/* Project progress cards */}
            {stats?.projects?.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>My Projects</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {stats.projects.map(p => (
                    <ProjectProgressCard key={p.id} project={p} />
                  ))}
                </div>
              </div>
            )}

            <div className="grid-2">
              <div className="card card-body">
                <h3 style={{ marginBottom: '1rem' }}>Quick Links</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <a href="/documents" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    <FileText size={16} /> View & Sign Documents
                  </a>
                  <a href="/projects" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    <FolderKanban size={16} /> View Project Progress
                  </a>
                  <a href="/payments" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                    <CreditCard size={16} /> Make Payment
                  </a>
                </div>
              </div>

              <div className="card card-body">
                <h3 style={{ marginBottom: '1rem' }}>Payment Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Paid</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      ${(stats?.total_paid || 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pending</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>
                      {stats?.pending_payments || 0} payment(s)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
