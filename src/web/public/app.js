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
  const base = (window.APP_BASE || '').replace(/\/+$/, '');
  const fullUrl = url.startsWith('/') ? base + url : url;
  // Ensure cookies/credentials are sent for same-origin requests by default
  const { headers: callerHeaders, ...restOptions } = options || {};
  const headers = { 'Content-Type': 'application/json', ...(callerHeaders ?? {}) };

  const resp = await fetch(fullUrl, {
    credentials: 'same-origin',
    ...restOptions,
    headers
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

// ── Auth widget: show current user and logout action ─────────────────────────
(async function initAuthWidget() {
  const el = document.getElementById('auth');
  if (!el) return;

  try {
    const data = await apiFetch('/api/auth/me');
    const user = data.user;
    const name = user.name || user.email || 'User';
    el.innerHTML = `
      <span class="user-name">${esc(user.email)}</span>
      <button id="logoutBtn" class="btn btn-ghost btn-logout">Sign out</button>
    `;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const base = (window.APP_BASE || '').replace(/\/+$|^$/g, '');
        const target = (window.APP_BASE || '') + '/logout';
        // Redirect the browser to the server logout handler which may in turn
        // redirect to the external identity provider logout URL when configured.
        window.location.href = target;
      });
    }
  } catch (err) {
    // Unauthenticated or error — show a simple sign-in link (handled by proxy)
    const base = (window.APP_BASE || '').replace(/\/+$|^$/g, '');
    el.innerHTML = `<a href="${(window.APP_BASE || '') || '/'}" class="btn btn-ghost">Sign in</a>`;
  }
})();
