import { api } from '../boot/axios';

export function extractErrorMessage(err, fallback = 'Ошибка при выполнении операции') {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('; ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return err?.message || fallback;
}

export function notifySuccess($q, message) {
  $q.notify({ type: 'positive', message, position: 'top-right' });
}

export function notifyError($q, err, fallback) {
  $q.notify({
    type: 'negative',
    message: extractErrorMessage(err, fallback),
    position: 'top-right',
    timeout: 4500,
  });
}

export function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatFullName(emp) {
  if (!emp) return '';
  return [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ');
}

export function formatDate(val) {
  if (!val) return '—';
  const str = String(val).slice(0, 10);
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return str;
}

export function formatDateTime(val) {
  if (!val) return '—';
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return String(val);
  return dt.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatSalary(val) {
  if (val === null || val === undefined) return '—';
  return `${Number(val).toLocaleString('ru-RU')} ₽`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

export function getFileDownloadUrl(fileId) {
  const baseUrl = api.defaults.baseURL || 'http://localhost:3000';
  return `${baseUrl}/files/${fileId}/download`;
}

export function getEmploymentStatusLabel(status) {
  if (status === 'employed') return 'Работает';
  if (status === 'fired') return 'Уволен';
  return 'Не принят';
}

export function getEmploymentStatusColor(status) {
  if (status === 'employed') return 'positive';
  if (status === 'fired') return 'negative';
  return 'grey-7';
}

export function getActionTypeLabel(type) {
  const map = {
    hire: 'Прием на работу',
    transfer_dept: 'Кадровый перевод',
    change_salary: 'Изменение оклада',
    fire: 'Увольнение',
  };
  return map[type] || type;
}

export function getActionTypeColor(type) {
  const map = {
    hire: 'positive',
    transfer_dept: 'info',
    change_salary: 'warning',
    fire: 'negative',
  };
  return map[type] || 'primary';
}