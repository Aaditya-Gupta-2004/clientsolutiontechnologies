import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Users, Plus, Edit2, Trash2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client', phone: '', company: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getUsers({ search: search || undefined, role: roleFilter || undefined })
      .then(d => setUsers(d.users))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, roleFilter]);

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', role: 'client', phone: '', company: '' });
    setCreateModal(true);
    setEditUser(null);
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '', company: u.company || '' });
    setEditUser(u);
    setCreateModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Name and email required');
    if (!editUser && !form.password) return toast.error('Password required for new users');
    setSaving(true);
    try {
      if (editUser) {
        const upd = { name: form.name, email: form.email, phone: form.phone, company: form.company };
        if (form.password) upd.password = form.password;
        await updateUser(editUser.id, upd);
        toast.success('User updated!');
      } else {
        await createUser({ ...form });
        toast.success('User created!');
      }
      setCreateModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
      load();
    } catch { toast.error('Failed'); }
  };

  const columns = [
    {
      key: 'name', label: 'Name', sortable: true,
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#4F8EF7,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
          }}>
            {v?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'role', label: 'Role',
      render: (v) => <span className={`badge badge-${v}`}>{v}</span>
    },
    {
      key: 'company', label: 'Company',
      render: (v) => v || '—'
    },
    {
      key: 'is_active', label: 'Status',
      render: (v) => (
        <span className={`badge badge-${v ? 'signed' : 'rejected'}`}>
          {v ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'created_at', label: 'Joined', sortable: true,
      render: (v) => v ? format(new Date(v), 'MMM d, yyyy') : '—'
    },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button className="btn btn-icon btn-ghost" onClick={() => openEdit(row)} data-tooltip="Edit">
            <Edit2 size={15} />
          </button>
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => handleToggleActive(row)}
            data-tooltip={row.is_active ? 'Deactivate' : 'Activate'}
            style={{ color: row.is_active ? 'var(--accent-amber)' : 'var(--accent-green)' }}
          >
            <UserCheck size={15} />
          </button>
          {isSuperAdmin && (
            <button className="btn btn-icon btn-danger" onClick={() => handleDelete(row)} data-tooltip="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    },
  ];

  return (
    <>
      <Navbar title="Users" subtitle={isSuperAdmin ? 'Manage all users and roles' : 'Manage your clients'} />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Users</h1>
            <p>{isSuperAdmin ? 'Manage admins and clients across the platform.' : 'Create and manage your client accounts.'}</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add User
          </button>
        </div>

        <div className="filters-row">
          <input
            className="form-input" style={{ maxWidth: 240 }}
            placeholder="Search by name or email…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select" style={{ maxWidth: 160 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            {isSuperAdmin && <option value="superadmin">Super Admin</option>}
            {isSuperAdmin && <option value="admin">Admin</option>}
            <option value="client">Client</option>
          </select>
        </div>

        <div className="card">
          <DataTable columns={columns} data={users} loading={loading} emptyText="No users found" />
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={createModal}
        onClose={() => { setCreateModal(false); setEditUser(null); }}
        title={editUser ? `Edit: ${editUser.name}` : 'Add New User'}
      >
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} disabled={!!editUser}>
                  <option value="client">Client</option>
                  {isSuperAdmin && <option value="admin">Admin</option>}
                  {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 234 567 8900" />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Corp" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setCreateModal(false); setEditUser(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : editUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
