## 2025-10-27 - [Real-time Character Counter in TUI]
**Learning:** In terminal-based questionnaires, providing immediate feedback on character limits through Inquirer's `transformer` significantly improves the user experience by preventing validation errors before they happen.
**Action:** Always check for `maxLength` validation in text input components and implement a `transformer` to display a `[current/max]` counter, using color coding (e.g., red) when the limit is exceeded.

## 2025-10-27 - [Live Feedback for Email Formats in TUI]
**Learning:** For specialized text inputs like email addresses, live validation feedback in the prompt (e.g., "Valid email format" vs. "Incomplete email") reduces user uncertainty and prevents submission errors.
**Action:** In `EmailInputComponent`, use a `transformer` to provide real-time feedback on the validity of the current email string being typed.

## 2025-10-27 - [Interactive Number Inputs with Range Hints]
**Learning:** Real-time feedback and constraint hints (like min/max ranges and integer requirements) for numeric inputs in a TUI help users provide valid data on the first try.
**Action:** Implement a `transformer` in `NumberInputComponent` that displays the allowed range/type when empty and live validation status when the user starts typing.
