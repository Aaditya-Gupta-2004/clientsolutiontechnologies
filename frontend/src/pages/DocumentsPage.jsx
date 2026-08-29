import { useState, useEffect } from 'react';
import { getDocuments, deleteDocument, getUsers, createDocument, sendDocument } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { FileText, Plus, Send, Trash2, Eye, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function DocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [sendModal, setSendModal] = useState(null);   // doc to send
  const [clients, setClients] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Create form state
  const [form, setForm] = useState({ title: '', description: '', client_id: '', file: null });
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendClientId, setSendClientId] = useState('');

  const loadDocs = () => {
    setLoading(true);
    getDocuments({ status: statusFilter || undefined, search: search || undefined })
      .then(d => setDocs(d.documents))
      .catch(() => toast.error('Failed to load documents'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDocs(); }, [statusFilter, search]);

  useEffect(() => {
    if (isAdmin) {
      getUsers({ role: 'client' })
        .then(d => setClients(d.users))
        .catch(() => {});
    }
  }, [isAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title) return toast.error('Title is required');
    setCreating(true);
    const fd = new FormData();
    fd.append('title', form.title);
    if (form.description) fd.append('description', form.description);
    if (form.client_id) fd.append('client_id', form.client_id);
    if (form.file) fd.append('file', form.file);
    try {
      await createDocument(fd);
      toast.success('Document created!');
      setCreateModal(false);
      setForm({ title: '', description: '', client_id: '', file: null });
      loadDocs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async () => {
    if (!sendClientId) return toast.error('Select a client');
    setSending(true);
    try {
      await sendDocument(sendModal.id, parseInt(sendClientId));
      toast.success('Document sent!');
      setSendModal(null);
      loadDocs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    try {
      await deleteDocument(doc.id);
      toast.success('Deleted');
      loadDocs();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const columns = [
    {
      key: 'title', label: 'Document', sortable: true,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {row.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.description.slice(0, 50)}</div>}
        </div>
      )
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <span className={`badge badge-${v}`}>{v}</span>
    },
    {
      key: 'client_name', label: 'Client',
      render: (v) => v || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
    },
    {
      key: 'created_at', label: 'Created', sortable: true,
      render: (v) => v ? format(new Date(v), 'MMM d, yyyy') : '—'
    },
    {
      key: 'signed_at', label: 'Signed',
      render: (v) => v ? format(new Date(v), 'MMM d, yyyy') : '—'
    },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => navigate(`/documents/${row.id}`)}
            data-tooltip="View"
          ><Eye size={15} /></button>
          {isAdmin && row.status === 'draft' && (
            <button
              className="btn btn-icon btn-ghost"
              onClick={() => { setSendModal(row); setSendClientId(''); }}
              data-tooltip="Send to Client"
              style={{ color: 'var(--accent-blue)' }}
            ><Send size={15} /></button>
          )}
          {isAdmin && (
            <button
              className="btn btn-icon btn-danger"
              onClick={() => handleDelete(row)}
              data-tooltip="Delete"
            ><Trash2 size={15} /></button>
          )}
        </div>
      )
    },
  ];

  return (
    <>
      <Navbar title="Documents" subtitle={isAdmin ? 'Create and manage documents' : 'Your documents to review and sign'} />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Documents</h1>
            <p>{isAdmin ? 'Upload, send, and track e-sign documents.' : 'Review and sign your documents below.'}</p>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
              <Plus size={16} /> Create Document
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="filters-row">
          <input
            className="form-input" style={{ maxWidth: 240 }}
            placeholder="Search documents…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select" style={{ maxWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="signed">Signed</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={loadDocs}>Refresh</button>
        </div>

        <div className="card">
          <DataTable columns={columns} data={docs} loading={loading} emptyText="No documents found" />
        </div>
      </div>

      {/* Create Document Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Document">
        <form onSubmit={handleCreate}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="form-group">
              <label className="form-label">Assign to Client (optional)</label>
              <select className="form-select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">— Select Client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Upload PDF (optional)</label>
              <input
                type="file" accept=".pdf" className="form-input" style={{ padding: '0.5rem' }}
                onChange={e => setForm(f => ({ ...f, file: e.target.files[0] }))}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Leave empty to auto-generate a placeholder PDF
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating…</> : <><FileText size={16} /> Create</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Send Document Modal */}
      <Modal open={!!sendModal} onClose={() => setSendModal(null)} title="Send Document to Client">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p>Select a client to send <strong>{sendModal?.title}</strong> for e-signing:</p>
          <div className="form-group">
            <label className="form-label">Client</label>
            <select className="form-select" value={sendClientId} onChange={e => setSendClientId(e.target.value)}>
              <option value="">— Select Client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setSendModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
            {sending ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Sending…</> : <><Send size={16} /> Send</>}
          </button>
        </div>
      </Modal>
    </>
  );
}
