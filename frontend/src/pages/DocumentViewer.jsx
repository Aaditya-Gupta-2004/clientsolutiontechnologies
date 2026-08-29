import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getDocument, signDocument, downloadDocument, deleteDocument } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import SignaturePad from '../components/SignaturePad';
import { FileText, Download, PenLine, ArrowLeft, CheckCircle, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DocumentViewer() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const sigPadRef = useRef();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  const loadPdfBlob = async (signedMode = false) => {
    setPdfLoading(true);
    try {
      const isDocSigned = signedMode || doc?.status === 'signed';
      const res = await api.get(`/documents/${id}/download?t=${Date.now()}${isDocSigned ? '&signed=true' : ''}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (err) {
      console.error('Failed to load PDF blob:', err);
      const BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      setPdfBlobUrl(`${BASE}/api/v1/documents/${id}/download?token=${token}&t=${Date.now()}`);
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    getDocument(id)
      .then(d => {
        setDoc(d);
        loadPdfBlob(d.status === 'signed');
      })
      .catch(() => {
        toast.error('Document not found');
        navigate('/documents');
      })
      .finally(() => setLoading(false));

    return () => {
      if (pdfBlobUrl && pdfBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [id]);

  const handleSign = async () => {
    const sigData = sigPadRef.current?.getSignatureData();
    if (!sigData) return toast.error('Please provide a signature');

    setSigning(true);
    try {
      const updated = await signDocument(id, sigData);
      setDoc(updated);
      setShowSignModal(false);
      toast.success('Document signed successfully! ✅');
      loadPdfBlob(true); // Load newly signed PDF
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to sign');
    } finally {
      setSigning(false);
    }
  };

  if (loading || !doc) return (
    <>
      <Navbar title="Document" />
      <div className="page-container loading-overlay">
        <div className="spinner spinner-lg" />
      </div>
    </>
  );

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canSign = user?.role === 'client' && doc.status === 'sent';
  const isSigned = doc.status === 'signed';

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete "${doc.title}"?`)) return;
    try {
      await deleteDocument(id);
      toast.success('Document deleted successfully');
      navigate('/documents');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete document');
    }
  };

  return (
    <>
      <Navbar title={doc.title} subtitle="Document Viewer" />
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-ghost btn-icon" onClick={() => navigate('/documents')}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {doc.title}
                <span className={`badge badge-${doc.status}`}>{doc.status}</span>
              </h1>
              {doc.description && <p style={{ marginTop: '0.25rem' }}>{doc.description}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {isSigned && (
              <button className="btn btn-secondary" onClick={() => downloadDocument(id, true)}>
                <Download size={16} /> Download Signed PDF
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => downloadDocument(id, false)}>
              <Download size={16} /> Download Original
            </button>
            {pdfBlobUrl && (
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                title="Open in new tab"
              >
                <ExternalLink size={16} /> Open Fullscreen
              </a>
            )}
            {canSign && (
              <button className="btn btn-primary" onClick={() => setShowSignModal(true)}>
                <PenLine size={16} /> Sign Document
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-danger" onClick={handleDelete} title="Delete Document">
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Signed banner */}
        {isSigned && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem'
          }}>
            <CheckCircle size={20} color="var(--accent-green)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent-green)' }}>Document Signed</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Signed on {doc.signed_at ? new Date(doc.signed_at).toLocaleString() : '—'}
              </div>
            </div>
          </div>
        )}

        {/* PDF Embed Viewer */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body" style={{ padding: '0.5rem', minHeight: '75vh', position: 'relative' }}>
            {pdfLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '75vh', gap: '0.75rem', color: 'var(--text-muted)' }}>
                <div className="spinner spinner-lg" />
                <span>Loading Document Preview…</span>
              </div>
            ) : pdfBlobUrl ? (
              <object
                data={pdfBlobUrl}
                type="application/pdf"
                style={{ width: '100%', height: '75vh', borderRadius: 'var(--radius-md)', display: 'block' }}
              >
                <iframe
                  src={pdfBlobUrl}
                  title={doc.title}
                  style={{ width: '100%', height: '75vh', border: 'none', borderRadius: 'var(--radius-md)' }}
                />
              </object>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Failed to load document preview.
              </div>
            )}
          </div>
        </div>

        {/* Document metadata */}
        <div className="card card-body">
          <h3 style={{ marginBottom: '1rem' }}>Document Information</h3>
          <div className="grid-3" style={{ gap: '1.5rem' }}>
            {[
              { label: 'Status', value: <span className={`badge badge-${doc.status}`}>{doc.status}</span> },
              { label: 'Created by', value: doc.created_by_name || 'System Admin' },
              { label: 'Assigned to', value: doc.client_name || 'Unassigned' },
              { label: 'Sent at', value: doc.sent_at ? new Date(doc.sent_at).toLocaleString() : '—' },
              { label: 'Signed at', value: doc.signed_at ? new Date(doc.signed_at).toLocaleString() : '—' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{item.label}</div>
                <div style={{ fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sign Modal */}
      {showSignModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowSignModal(false)}>
          <div className="modal modal-lg" role="dialog">
            <div className="modal-header">
              <h3><PenLine size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />Sign Document</h3>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowSignModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Draw, type, or upload an image of your signature below. By clicking <strong>Sign & Accept</strong>, you legally approve and execute <strong>{doc.title}</strong>.
              </p>
              <SignaturePad ref={sigPadRef} onSave={() => {}} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSignModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSign} disabled={signing}>
                {signing ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Signing…</> : <><PenLine size={16} /> Sign & Accept Document</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
