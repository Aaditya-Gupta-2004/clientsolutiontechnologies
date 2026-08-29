import { useState, useEffect } from 'react';
import { getProjects, createProject, updateProjectPhases, deleteProject, getUsers } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ProjectProgressCard from '../components/ProjectProgressCard';
import { FolderKanban, Plus, Trash2, Settings2, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const PHASE_COLORS = ['#4F8EF7', '#8B5CF6', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444'];

export default function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [progressModal, setProgressModal] = useState(null);
  const [clients, setClients] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  const [form, setForm] = useState({ name: '', description: '', client_id: '', deadline: '', phases: [] });
  const [creating, setCreating] = useState(false);
  const [editPhases, setEditPhases] = useState([]);
  const [savingPhases, setSavingPhases] = useState(false);

  const load = () => {
    setLoading(true);
    getProjects()
      .then(d => setProjects(d.projects))
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (isAdmin) getUsers({ role: 'client' }).then(d => setClients(d.users)).catch(() => {});
  }, [isAdmin]);

  const addPhase = () => {
    setForm(f => ({
      ...f,
      phases: [...f.phases, { name: '', weight: 20, completion: 0, description: '' }]
    }));
  };

  const removePhase = (i) => setForm(f => ({ ...f, phases: f.phases.filter((_, idx) => idx !== i) }));

  const updatePhaseField = (i, field, val) => setForm(f => ({
    ...f,
    phases: f.phases.map((p, idx) => idx === i ? { ...p, [field]: val } : p)
  }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.client_id) return toast.error('Name and client are required');
    setCreating(true);
    try {
      await createProject({
        name: form.name,
        description: form.description,
        client_id: parseInt(form.client_id),
        phases: form.phases,
        deadline: form.deadline || undefined,
      });
      toast.success('Project created!');
      setCreateModal(false);
      setForm({ name: '', description: '', client_id: '', deadline: '', phases: [] });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const openProgress = (proj) => {
    setProgressModal(proj);
    setEditPhases(proj.phases.map(p => ({ ...p })));
  };

  const handleSavePhases = async () => {
    setSavingPhases(true);
    try {
      await updateProjectPhases(progressModal.id, editPhases);
      toast.success('Progress updated!');
      setProgressModal(null);
      load();
    } catch (err) {
      toast.error('Failed to update');
    } finally {
      setSavingPhases(false);
    }
  };

  const handleDelete = async (proj) => {
    if (!confirm(`Delete "${proj.name}"?`)) return;
    try {
      await deleteProject(proj.id);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed'); }
  };

  const columns = [
    {
      key: 'name', label: 'Project', sortable: true,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.client_name}</div>
        </div>
      )
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <span className={`badge badge-${v}`}>{v?.replace('_', ' ')}</span>
    },
    {
      key: 'overall_completion', label: 'Progress', sortable: true,
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 120 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${v}%`, background: 'linear-gradient(90deg,#4F8EF7,#8B5CF6)', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 32 }}>{Math.round(v)}%</span>
        </div>
      )
    },
    {
      key: 'deadline', label: 'Deadline',
      render: (v) => v ? format(new Date(v), 'MMM d, yyyy') : '—'
    },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {isAdmin && (
            <button className="btn btn-icon btn-ghost" onClick={() => openProgress(row)} data-tooltip="Update Progress">
              <BarChart3 size={15} />
            </button>
          )}
          {isAdmin && (
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
      <Navbar title="Projects" subtitle={isAdmin ? 'Manage project progress' : 'Track your project progress'} />
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Projects</h1>
            <p>{isAdmin ? 'Create projects and update phase completion for clients.' : 'View your project status and phase progress.'}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className={`btn btn-secondary btn-sm`}
              onClick={() => setViewMode(v => v === 'table' ? 'cards' : 'table')}
            >
              {viewMode === 'table' ? <><BarChart3 size={14} /> Card View</> : <><Settings2 size={14} /> Table View</>}
            </button>
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
                <Plus size={16} /> New Project
              </button>
            )}
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="card">
            <DataTable columns={columns} data={projects} loading={loading} emptyText="No projects found" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading
              ? <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
              : projects.length === 0
                ? <div className="empty-state"><FolderKanban size={48} /><h3>No projects yet</h3></div>
                : projects.map(p => (
                    <div key={p.id} style={{ position: 'relative' }}>
                      <ProjectProgressCard project={p} />
                      {isAdmin && (
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ position: 'absolute', top: '1rem', right: '1rem' }}
                          onClick={() => openProgress(p)}
                        >
                          <BarChart3 size={14} /> Update Progress
                        </button>
                      )}
                    </div>
                  ))
            }
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Project" size="lg">
        <form onSubmit={handleCreate}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Website Redesign" required />
              </div>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select className="form-select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
                  <option value="">— Select Client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input type="date" className="form-input" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>

            {/* Phases */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Project Phases</label>
                <button type="button" className="btn btn-sm btn-secondary" onClick={addPhase}><Plus size={14} /> Add Phase</button>
              </div>
              {form.phases.map((phase, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center'
                }}>
                  <input
                    className="form-input" placeholder={`Phase ${i + 1} name`}
                    value={phase.name} onChange={e => updatePhaseField(i, 'name', e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="number" className="form-input" placeholder="Weight%" min={0} max={100}
                      value={phase.weight} onChange={e => updatePhaseField(i, 'weight', Number(e.target.value))}
                      style={{ width: 80 }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>wt</span>
                  </div>
                  <div
                    style={{ width: 14, height: 14, borderRadius: '50%', background: PHASE_COLORS[i % PHASE_COLORS.length] }}
                  />
                  <button type="button" className="btn btn-icon btn-danger btn-sm" onClick={() => removePhase(i)}>✕</button>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating…</> : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Progress Modal */}
      <Modal open={!!progressModal} onClose={() => setProgressModal(null)} title={`Update: ${progressModal?.name}`} size="lg">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {editPhases.length === 0 ? (
            <p>No phases defined for this project.</p>
          ) : (
            editPhases.map((phase, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: PHASE_COLORS[i % PHASE_COLORS.length] }} />
                    {phase.name}
                  </label>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: PHASE_COLORS[i % PHASE_COLORS.length] }}>
                    {phase.completion}%
                  </span>
                </div>
                <input
                  type="range" min={0} max={100} step={1}
                  value={phase.completion}
                  onChange={e => setEditPhases(ps => ps.map((p, idx) => idx === i ? { ...p, completion: Number(e.target.value) } : p))}
                  style={{ width: '100%', accentColor: PHASE_COLORS[i % PHASE_COLORS.length] }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>0%</span><span>100%</span>
                </div>
              </div>
            ))
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(79,142,247,0.06)', borderRadius: 'var(--radius-sm)',
            padding: '0.75rem'
          }}>
            <span style={{ fontWeight: 600 }}>Overall Completion</span>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent-blue)' }}>
              {Math.round(editPhases.reduce((acc, p) => acc + (p.weight * p.completion / 100), 0))}%
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setProgressModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSavePhases} disabled={savingPhases}>
            {savingPhases ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : 'Save Progress'}
          </button>
        </div>
      </Modal>
    </>
  );
}
