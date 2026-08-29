import { useState, useEffect } from 'react';
import { getPayments, createPayment, deletePayment, getUsers, getStripeConfig, downloadInvoice } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import StripeCheckout from '../components/StripeCheckout';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, Plus, Trash2, DollarSign, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function PaymentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [clients, setClients] = useState([]);
  const [stripePromise, setStripePromise] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const [form, setForm] = useState({ title: '', description: '', amount: '', currency: 'usd', client_id: '', due_date: '' });
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    getPayments({ status: statusFilter || undefined })
      .then(d => setPayments(d.payments))
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  useEffect(() => {
    if (isAdmin) getUsers({ role: 'client' }).then(d => setClients(d.users)).catch(() => {});
    // Load Stripe
    getStripeConfig()
      .then(cfg => setStripePromise(loadStripe(cfg.publishable_key)))
      .catch(() => {});
  }, [isAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.client_id) return toast.error('Title, amount, and client are required');
    setCreating(true);
    try {
      await createPayment({
        title: form.title,
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        client_id: parseInt(form.client_id),
        due_date: form.due_date || undefined,
      });
      toast.success('Payment request created!');
      setCreateModal(false);
      setForm({ title: '', description: '', amount: '', currency: 'usd', client_id: '', due_date: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete payment "${p.title}"?`)) return;
    try {
      await deletePayment(p.id);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed'); }
  };

  const formatAmount = (amount, currency = 'inr') => {
    const curr = currency?.toLowerCase();
    const symbol = curr === 'inr' ? '₹' : curr === 'eur' ? '€' : curr === 'gbp' ? '£' : '$';
    return `${symbol} ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns = [
    {
      key: 'title', label: 'Payment', sortable: true,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {row.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.description.slice(0, 50)}</div>}
        </div>
      )
    },
    {
      key: 'amount', label: 'Amount', sortable: true,
      render: (v, row) => (
        <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
          {formatAmount(v, row.currency)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.currency?.toUpperCase()}</span>
        </span>
      )
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <span className={`badge badge-${v}`}>{v}</span>
    },
    {
      key: 'client_name', label: 'Client',
      render: (v) => v || '—'
    },
    {
      key: 'due_date', label: 'Due Date',
      render: (v) => v ? format(new Date(v), 'MMM d, yyyy') : '—'
    },
    {
      key: 'paid_at', label: 'Paid At',
      render: (v) => v ? format(new Date(v), 'MMM d, yyyy') : '—'
    },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => downloadInvoice(row.id)}
            title="Download Tax Invoice"
          >
            <FileText size={13} /> Invoice
          </button>
          {row.status === 'pending' && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setPayModal(row)}
            >
              <CreditCard size={14} /> Pay Now
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-icon btn-danger" onClick={() => handleDelete(row)} title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    },
  ];

  return (
    <>
      <Navbar title="Payments" subtitle={isAdmin ? 'Create and manage payment requests' : 'Your pending and paid invoices'} />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Payments & Invoices</h1>
            <p>{isAdmin ? 'Create payment requests for clients in INR (₹) or USD ($) with credit/debit card checkout.' : 'View and pay your invoices securely.'}</p>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
              <Plus size={16} /> New Payment Request
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="filters-row">
          <select className="form-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
        </div>

        {/* Quick summary cards */}
        {payments.length > 0 && (
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            {[
              {
                label: 'Total Invoiced', color: 'var(--accent-blue)',
                value: '₹ ' + payments.reduce((a, p) => a + p.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
              },
              {
                label: 'Total Paid', color: 'var(--accent-green)',
                value: '₹ ' + payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
              },
              {
                label: 'Total Pending', color: 'var(--accent-red)',
                value: '₹ ' + payments.filter(p => p.status === 'pending').reduce((a, p) => a + p.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
              },
            ].map(item => (
              <div key={item.label} className="card card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <DataTable columns={columns} data={payments} loading={loading} emptyText="No payments found" />
        </div>
      </div>

      {/* Create Payment Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Payment Request">
        <form onSubmit={handleCreate}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Invoice #001 — Web Design & Development" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80 }} placeholder="Milestone deliverables, terms, and scope details" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input type="number" step="1" min="1" className="form-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 50000" required />
              </div>
              <div className="form-group">
                <label className="form-label">Currency *</label>
                <select className="form-select" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="inr">INR (₹ - Indian Rupee)</option>
                  <option value="usd">USD ($ - US Dollar)</option>
                  <option value="eur">EUR (€ - Euro)</option>
                  <option value="gbp">GBP (£ - British Pound)</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select className="form-select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
                  <option value="">— Select Client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating…</> : <><DollarSign size={16} /> Create Request</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Modal — Credit / Debit Card checkout */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Complete Payment" size="lg">
        <div className="modal-body">
          {payModal && (
            stripePromise ? (
              <Elements stripe={stripePromise} options={{ appearance: { theme: 'night' } }}>
                <StripeCheckout
                  payment={payModal}
                  onSuccess={() => {
                    setPayModal(null);
                    setTimeout(load, 500);
                  }}
                />
              </Elements>
            ) : (
              <StripeCheckout
                payment={payModal}
                onSuccess={() => {
                  setPayModal(null);
                  setTimeout(load, 500);
                }}
              />
            )
          )}
        </div>
      </Modal>
    </>
  );
}
