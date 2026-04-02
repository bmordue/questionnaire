## 2025-05-15 - [Rating Component Star Icons]
**Learning:** Visual indicators like star icons in a rating component provide immediate, intuitive feedback to users, making the experience more pleasant and clear compared to just numbers.
**Action:** When implementing rating or scale-based inputs in terminal UIs, consider adding visual representations (like stars, bars, or blocks) alongside numeric values.

## 2025-10-27 - [Live Validation and Constraint Hints in TUI]
**Learning:** Using Inquirer's `transformer` property to provide real-time feedback (like character counts, range hints, and validation status) significantly reduces user error and cognitive load before they even submit an answer.
**Action:** Apply the "Empty Input Hint" and "Typing Feedback" pattern to all interactive text-based components to provide immediate, actionable guidance.

## 2025-11-20 - [List Prompts for Boolean Selection]
**Learning:** In terminal UIs, using a `list` prompt with explicit 'Yes' and 'No' options provides a more intuitive and visible selection experience than the standard `confirm` prompt (y/N), as it allows for arrow-key navigation and clearer state feedback.
**Action:** Prefer `list` prompts over `confirm` prompts for binary choices to improve accessibility and consistency across different terminal emulators.

## 2025-12-05 - [Displaying Choice Descriptions in TUI]
**Learning:** Inquirer allows multi-line strings for choice names. Appending descriptions on a new line with indentation and muted styling (using `theme.muted`) provides valuable context for complex choices without cluttering the main labels.
**Action:** Always check for `option.description` in choice-based components and render them visually distinct from the main label to improve decision-making clarity.

## 2025-12-20 - [Dynamic Hints and Live Feedback for Date Inputs]
**Learning:** Moving static format hints (like 'YYYY-MM-DD') from the question text into a dynamic `transformer` property in TUI prompts creates a cleaner interface while enabling real-time feedback (e.g., success/warning status and localized date confirmation) as the user types, reducing cognitive load and input errors.
**Action:** Use the `transformer` property for all pattern-based or constrained text inputs to provide dynamic guidance and immediate validation feedback.
