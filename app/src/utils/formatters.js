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