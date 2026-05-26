## 2025-05-14 - Information Disclosure via Error Leakage
**Vulnerability:** Direct stringification of internal errors (e.g., `res.status(500).json({ error: String(err) })`) in Express route handlers.
**Learning:** This pattern can leak sensitive system information such as stack traces, internal file paths, and database details to the client, which can be used by attackers to map the application's internals.
**Prevention:** Always delegate unhandled errors to a central error handling middleware using `next(err)`. The central handler should return a generic error message to the client while logging the full details internally for debugging.

## 2025-05-15 - Path Traversal via Unvalidated User IDs
**Vulnerability:** User-provided IDs (questionnaires, responses, sessions, user IDs) used directly in file path construction (e.g., `path.join(dir, id + '.json')`) without validation.
**Learning:** Even if Express/Node.js decodes URL-encoded separators like `..%2f`, using them in path construction can escape the intended data directory.
**Prevention:** Implement a strict allow-list validation for all IDs used in file paths. Use `FileOperations.validateId(id)` with a safe regex (e.g., `/^[a-zA-Z0-9\-_]+$/`) at the lowest possible level in the storage layer.

## 2026-05-26 - Inconsistent ID Validation Across Storage Backends
**Vulnerability:** ID validation was enforced in filesystem-based stores but missing in the generic `BackendStorageService` used for S3. Malicious identifiers could manipulate backend keys or overwrite adjacent objects in S3-compatible storage.
**Learning:** Security guarantees must be enforced at the abstract interface boundary (`StorageService`) to ensure consistent protection regardless of the concrete implementation. Relying on downstream filesystem checks leaves other backends (like S3) vulnerable.
**Prevention:** Centralize identifier validation at the `StorageService` boundary. Every implementation (`FileStorageService`, `BackendStorageService`) must validate user-provided IDs before processing. Additionally, use early validation in the web layer as defense-in-depth to provide better error feedback.
