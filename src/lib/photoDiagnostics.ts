// Temporary camera investigation: a bounded text trace, never photos or spool data.
const key = 'rfid-photo-diagnostics';
let entries: string[] = [];
try {
  const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
  if (Array.isArray(saved)) entries = saved.filter((entry): entry is string => typeof entry === 'string').slice(-60);
} catch { /* Diagnostics must not prevent editing when storage is unavailable. */ }
let active = entries.length > 0;
const page = Math.round(performance.timeOrigin).toString(36);
const navigation = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? 'unknown';
const discarded = (document as Document & { wasDiscarded?: boolean }).wasDiscarded;
const pageInfo = `Page started (${page}); navigation=${navigation}; discarded=${discarded ?? 'unsupported'}`;

export function tracePhoto(message: string) {
  if (!active) { active = true; append(pageInfo); }
  append(message);
}
function append(message: string) {
  entries.push(`${new Date().toISOString()} [${page}] ${message}`);
  entries = entries.slice(-60);
  try { sessionStorage.setItem(key, JSON.stringify(entries)); } catch { /* Keep in-memory fallback. */ }
}
export function readPhotoTrace() { return entries.join('\n'); }
export function savePhotoTrace() {
  const url = URL.createObjectURL(new Blob([readPhotoTrace()], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'photo-picker-diagnostics.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
if (active) append(pageInfo);
document.addEventListener('visibilitychange', () => { if (active) append(`Visibility: ${document.visibilityState}`); });
window.addEventListener('pagehide', event => { if (active) append(`Page hidden; back/forward cache=${event.persisted}`); });
window.addEventListener('pageshow', event => { if (active) append(`Page shown; back/forward cache=${event.persisted}`); });
window.addEventListener('error', event => { if (active) append(`Browser error: ${event.message}`); });
window.addEventListener('unhandledrejection', event => { if (active) append(`Unhandled error: ${String(event.reason).slice(0, 200)}`); });
