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

/** Build an app-relative URL honoring window.APP_BASE */
function appUrl(path) {
  const base = (window.APP_BASE || '').replace(/\/+$/, '');
  return base + path;
}

// ── Auth widget: show current user and logout action ─────────────────────────
(async function initAuthWidget() {
  const el = document.getElementById('auth');
  if (!el) return;

  try {
    const data = await apiFetch('/api/auth/me');
    const user = data.user;
    if (!user || user.id === 'guest') throw new Error('Guest user');

    const userName = document.createElement('span');
    userName.className = 'user-name';
    userName.textContent = user.name || user.email || 'User';

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logoutBtn';
    logoutBtn.className = 'btn btn-ghost btn-logout';
    logoutBtn.textContent = 'Sign out';
    logoutBtn.addEventListener('click', () => {
      // Redirect the browser to the server logout handler which may in turn
      // redirect to the external identity provider logout URL when configured.
      window.location.href = appUrl('/logout');
    });

    el.replaceChildren(userName, logoutBtn);
  } catch (err) {
    // Unauthenticated or error — show a simple sign-in link (handled by proxy)
    const signIn = document.createElement('a');
    signIn.className = 'btn btn-ghost';
    signIn.href = appUrl('') || '/';
    signIn.textContent = 'Sign in';
    el.replaceChildren(signIn);
  }
})();
