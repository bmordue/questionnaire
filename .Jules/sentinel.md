## 2025-05-14 - Information Disclosure via Error Leakage
**Vulnerability:** Direct stringification of internal errors (e.g., `res.status(500).json({ error: String(err) })`) in Express route handlers.
**Learning:** This pattern can leak sensitive system information such as stack traces, internal file paths, and database details to the client, which can be used by attackers to map the application's internals.
**Prevention:** Always delegate unhandled errors to a central error handling middleware using `next(err)`. The central handler should return a generic error message to the client while logging the full details internally for debugging.
