import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://clientsolutiontechnologies.onrender.com/api/v1' 
    : 'http://localhost:8000/api/v1');

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/* ── Auth ─────────────────────────── */
export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data);

export const getMe = () => api.get('/auth/me').then(r => r.data);

export const changePassword = (data) =>
  api.post('/auth/change-password', data).then(r => r.data);

/* ── Dashboard ────────────────────── */
export const getDashboardStats = () =>
  api.get('/dashboard/stats').then(r => r.data);

export const getAuditLogs = (params = {}) =>
  api.get('/dashboard/audit-logs', { params }).then(r => r.data);

/* ── Users ────────────────────────── */
export const getUsers = (params = {}) =>
  api.get('/users', { params }).then(r => r.data);

export const getUser = (id) => api.get(`/users/${id}`).then(r => r.data);

export const createUser = (data) =>
  api.post('/users', data).then(r => r.data);

export const updateUser = (id, data) =>
  api.put(`/users/${id}`, data).then(r => r.data);

export const deleteUser = (id) =>
  api.delete(`/users/${id}`).then(r => r.data);

/* ── Documents ────────────────────── */
export const getDocuments = (params = {}) =>
  api.get('/documents', { params }).then(r => r.data);

export const getDocument = (id) =>
  api.get(`/documents/${id}`).then(r => r.data);

export const createDocument = (formData) =>
  api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);

export const sendDocument = (id, clientId) =>
  api.post(`/documents/${id}/send`, { client_id: clientId }).then(r => r.data);

export const signDocument = (id, signatureData) =>
  api.post(`/documents/${id}/sign`, { signature_data: signatureData }).then(r => r.data);

export const downloadDocument = async (id, signed = false) => {
  const token = localStorage.getItem('token');
  try {
    const res = await api.get(`/documents/${id}/download?signed=${signed}`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `Document_${id}${signed ? '_signed' : ''}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    window.open(`${BASE_URL}/documents/${id}/download?signed=${signed}&token=${token}`, '_blank');
  }
};

export const deleteDocument = (id) =>
  api.delete(`/documents/${id}`).then(r => r.data);

/* ── Projects ─────────────────────── */
export const getProjects = (params = {}) =>
  api.get('/projects', { params }).then(r => r.data);

export const getProject = (id) =>
  api.get(`/projects/${id}`).then(r => r.data);

export const createProject = (data) =>
  api.post('/projects', data).then(r => r.data);

export const updateProject = (id, data) =>
  api.put(`/projects/${id}`, data).then(r => r.data);

export const updateProjectPhases = (id, phases) =>
  api.patch(`/projects/${id}/phases`, { phases }).then(r => r.data);

export const deleteProject = (id) =>
  api.delete(`/projects/${id}`).then(r => r.data);

/* ── Payments ─────────────────────── */
export const getPayments = (params = {}) =>
  api.get('/payments', { params }).then(r => r.data);

export const getPayment = (id) =>
  api.get(`/payments/${id}`).then(r => r.data);

export const createPayment = (data) =>
  api.post('/payments', data).then(r => r.data);

export const updatePayment = (id, data) =>
  api.put(`/payments/${id}`, data).then(r => r.data);

export const deletePayment = (id) =>
  api.delete(`/payments/${id}`).then(r => r.data);

export const createPaymentIntent = (id) =>
  api.post(`/payments/${id}/create-intent`).then(r => r.data);

export const getStripeConfig = () =>
  api.get('/payments/config').then(r => r.data);

export const confirmDemoPayment = (id) =>
  api.post(`/payments/${id}/confirm-demo-payment`).then(r => r.data);

export const downloadInvoice = async (paymentId) => {
  try {
    const res = await api.get(`/payments/${paymentId}/invoice`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `Invoice_INV_${paymentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    const token = localStorage.getItem('token');
    window.open(`${BASE_URL}/payments/${paymentId}/invoice?token=${token}`, '_blank');
  }
};

export default api;

