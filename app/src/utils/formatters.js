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