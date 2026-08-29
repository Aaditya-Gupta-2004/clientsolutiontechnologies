import { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ACTION_COLORS = {
  'auth.login': 'teal',
  'user.created': 'blue',
  'user.updated': 'purple',
  'user.deleted': 'red',
  'document.created': 'blue',
  'document.sent': 'purple',
  'document.signed': 'green',
  'document.deleted': 'red',
  'project.created': 'blue',
  'project.updated': 'purple',
  'project.phases_updated': 'teal',
  'payment.created': 'blue',
  'payment.paid': 'green',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    getAuditLogs({ action: actionFilter || undefined, limit: 100 })
      .then(d => { setLogs(d.logs); setTotal(d.total); })
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [actionFilter]);

  const columns = [
    {
      key: 'created_at', label: 'Time', sortable: true,
      render: (v) => v ? format(new Date(v), 'MMM d, yyyy HH:mm:ss') : '—'
    },
    {
      key: 'user_name', label: 'User',
      render: (v) => v || 'System'
    },
    {
      key: 'action', label: 'Action',
      render: (v) => {
        const color = ACTION_COLORS[v] || 'blue';
        return <span className={`badge badge-${color === 'green' ? 'signed' : color === 'red' ? 'rejected' : color === 'teal' ? 'processing' : 'sent'}`}>{v}</span>;
      }
    },
    { key: 'target_type', label: 'Type', render: (v) => v || '—' },
    { key: 'target_id', label: 'ID', render: (v) => v || '—' },
    { key: 'ip_address', label: 'IP Address', render: (v) => v || '—' },
    {
      key: 'detail', label: 'Details',
      render: (v) => v ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {v.length > 60 ? v.slice(0, 60) + '…' : v}
        </span>
      ) : '—'
    },
  ];

  return (
    <>
      <Navbar title="Audit Logs" subtitle="All system actions and events" />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Audit Logs</h1>
            <p>Track all user and system actions for compliance and security. Total: {total} events.</p>
          </div>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>

        <div className="filters-row">
          <input
            className="form-input" style={{ maxWidth: 280 }}
            placeholder="Filter by action (e.g. document.signed)…"
            value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          />
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {Object.entries(ACTION_COLORS).slice(0, 6).map(([action]) => (
            <span key={action} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{action}</span>
          ))}
        </div>

        <div className="card">
          <DataTable columns={columns} data={logs} loading={loading} emptyText="No audit logs found" />
        </div>
      </div>
    </>
  );
}
