import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Budgets
export const getBudgets = () => axios.get(`${API}/budgets`);
export const getBudget = (id) => axios.get(`${API}/budgets/${id}`);
export const createBudget = (data) => axios.post(`${API}/budgets`, data);
export const updateBudget = (id, data) => axios.put(`${API}/budgets/${id}`, data);
export const deleteBudget = (id) => axios.delete(`${API}/budgets/${id}`);

// Monthly Budgets
export const getMonthlyBudgets = (params) => axios.get(`${API}/monthly-budgets`, { params });
export const getMonthlyBudget = (id) => axios.get(`${API}/monthly-budgets/${id}`);

// Payments
export const getPayments = (params) => axios.get(`${API}/payments`, { params });
export const getPayment = (id) => axios.get(`${API}/payments/${id}`);
export const createPayment = (data) => axios.post(`${API}/payments`, data);
export const getPaymentPDF = (id) => axios.get(`${API}/payments/${id}/pdf`, { responseType: 'blob' });

// Dashboard
export const getDashboardKPI = (params) => axios.get(`${API}/dashboard/kpi`, { params });
export const getMonthlySummary = (year) => axios.get(`${API}/dashboard/monthly-summary`, { params: { year } });

// Users
export const getUsers = () => axios.get(`${API}/users`);
export const updateUser = (id, data) => axios.put(`${API}/users/${id}`, data);

// Audit Logs
export const getAuditLogs = (params) => axios.get(`${API}/audit-logs`, { params });
export const getAuditLogsCount = (params) => axios.get(`${API}/audit-logs/count`, { params });

// Notification Config
export const getNotificationConfig = () => axios.get(`${API}/notification-config`);
export const updateNotificationConfig = (data) => axios.put(`${API}/notification-config`, data);

// Reports
export const getMonthlyReportPDF = (month, year) => 
  axios.get(`${API}/reports/monthly-pdf`, { params: { month, year }, responseType: 'blob' });

// Test notifications
export const testWhatsApp = (phone, message) => 
  axios.post(`${API}/test/whatsapp`, null, { params: { phone, message } });
export const testEmail = (email) => 
  axios.post(`${API}/test/email`, null, { params: { email } });

// Utility functions
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const getMonthName = (month) => {
  const months = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
  };
  return months[month] || '';
};

export const getStatusBadge = (status) => {
  const badges = {
    pendiente: { class: 'badge-warning', label: 'Pendiente' },
    pagado: { class: 'badge-success', label: 'Pagado' },
    pagado_con_diferencia: { class: 'badge-info', label: 'Con Diferencia' },
    vencido: { class: 'badge-error', label: 'Vencido' },
    activo: { class: 'badge-success', label: 'Activo' },
    inactivo: { class: 'badge-neutral', label: 'Inactivo' },
    completado: { class: 'badge-info', label: 'Completado' }
  };
  return badges[status] || { class: 'badge-neutral', label: status };
};

export const getExpenseTypeLabel = (type) => {
  const types = {
    fijo: 'Fijo',
    variable: 'Variable',
    ocasional: 'Ocasional'
  };
  return types[type] || type;
};
