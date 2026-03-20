/* Shared utilities for the Questionnaire web app */

/** Mark the current nav link as active based on the page filename */
(function markActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/** Thin wrapper around fetch that always parses JSON and rejects on HTTP errors */
async function apiFetch(url, options = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options
  });
  if (resp.status === 204) return null;
  const data = await resp.json();
  if (!resp.ok) {
    const err = new Error(data.error ?? `HTTP ${resp.status}`);
    err.responseData = data;
    throw err;
  }
  return data;
}

/** Show an alert element with a message */
function showAlert(el, msg, type = 'error') {
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

/** Hide an alert element */
function hideAlert(el) {
  el.classList.add('hidden');
}

/** Format an ISO date string for display */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}
