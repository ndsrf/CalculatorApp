# Canonical Glossary

All specifications in `openspec/specs/`, prompts in `prompts/`, and user-facing documentation MUST use the canonical terms defined below.

## Canonical Terms

| Term | Selector / Reference | Definition |
| --- | --- | --- |
| **Primary Readout** | `#display-current` | The main calculator output displaying the active entry, evaluated result, or error message. |
| **Expression Input** | `#expression-input` | The text field where a `@persona:power-user` types full arithmetic expressions with parentheses and operators. |
| **Clear Entry (CE)** | `[data-action="ce"]` | Clears the current active entry (or active Expression Input value) without resetting a pending accumulator or operator. |
| **All Clear (AC)** | `[data-action="ac"]` | Resets the entire calculator state (`display`, `accumulator`, `pendingOp`, `expressionInput`, and `errorState`). |
| **Standard Keypad** | `[data-key]`, `[data-op]`, `[data-action]` | The interactive button grid for digits `0`–`9`, arithmetic operators, `equals`, `Clear Entry (CE)`, and `All Clear (AC)`. |
| **Submit Expression** | `[data-action="submit-expression"]` | Action control that parses and evaluates the contents of the `Expression Input` and writes the outcome to the `Primary Readout`. |
| **Error State** | `errorState` | Locked calculator state entered on invalid operations (such as division by zero or syntax errors) that disables operator keys until `All Clear (AC)` is pressed. |

## Banned Synonyms

The deterministic linter (`scripts/lint-docs.ts`) parses this table and fails CI if any banned synonym appears in `openspec/specs/`.

| Banned Synonym | Use Canonical Term Instead |
| --- | --- |
| `textbox` | `Expression Input` |
| `search bar` | `Expression Input` |
| `input box` | `Expression Input` |
| `screen` | `Primary Readout` |
| `LCD` | `Primary Readout` |
| `reset button` | `All Clear (AC)` |
| `backspace` | `Clear Entry (CE)` |
| `numpad` | `Standard Keypad` |
