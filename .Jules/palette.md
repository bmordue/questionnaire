## 2025-10-27 - [Real-time Character Counter in TUI]
**Learning:** In terminal-based questionnaires, providing immediate feedback on character limits through Inquirer's `transformer` significantly improves the user experience by preventing validation errors before they happen.
**Action:** Always check for `maxLength` validation in text input components and implement a `transformer` to display a `[current/max]` counter, using color coding (e.g., red) when the limit is exceeded.
