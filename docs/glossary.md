# Canonical Glossary

All specifications in `openspec/specs/`, prompts in `prompts/`, and user-facing documentation MUST use the canonical terms defined below.

## Canonical Terms

| Term                       | Selector / Reference                       | Definition                                                                                                                                                                              |
| -------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary Readout**        | `#display-current`                         | The main calculator output displaying the active entry, evaluated result, or error message.                                                                                             |
| **Expression Input**       | `#expression-input`                        | The text field where a `@persona:power-user` types full arithmetic expressions with parentheses and operators.                                                                          |
| **Clear Entry (CE)**       | `[data-action="ce"]`                       | Clears the current active entry (or active Expression Input value) without resetting a pending accumulator or operator.                                                                 |
| **All Clear (AC)**         | `[data-action="ac"]`                       | Resets the entire calculator state (`display`, `accumulator`, `pendingOp`, `expressionInput`, and `errorState`).                                                                        |
| **Standard Keypad**        | `[data-key]`, `[data-op]`, `[data-action]` | The interactive button grid for digits `0`–`9`, arithmetic operators, `equals`, `Clear Entry (CE)`, and `All Clear (AC)`.                                                               |
| **Submit Expression**      | `[data-action="submit-expression"]`        | Action control that parses and evaluates the contents of the `Expression Input` and writes the outcome to the `Primary Readout`.                                                        |
| **Error State**            | `errorState`                               | Locked calculator state entered on invalid operations (such as division by zero, syntax errors, or a failed translation) that disables operator keys until `All Clear (AC)` is pressed. |
| **Natural Language Input** | `#natural-language-input`                  | The text field where a `@persona:casual-user` asks an arithmetic question in everyday words (for example, `15% of 80, plus 5`).                                                         |
| **Translate Question**     | `[data-action="translate-question"]`       | Action control that sends the `Natural Language Input` to the `Expression Translator`, writes the translated expression into the `Expression Input`, and evaluates it.                  |
| **Expression Translator**  | `src/ai/`, `POST /api/translate`           | The server-side AI component that converts a question into an arithmetic expression. It never computes results; its output is untrusted and is always checked by the safe parser.       |
| **Translation Refusal**    | `CANNOT_TRANSLATE`                         | The `Expression Translator`'s explicit answer when a question is not arithmetic. The `Primary Readout` shows `Could not translate question`.                                            |

## Banned Synonyms

The deterministic linter (`scripts/lint-docs.ts`) parses this table and fails CI if any banned synonym appears in `openspec/specs/`.

| Banned Synonym | Use Canonical Term Instead |
| -------------- | -------------------------- |
| `textbox`      | `Expression Input`         |
| `search bar`   | `Expression Input`         |
| `input box`    | `Expression Input`         |
| `screen`       | `Primary Readout`          |
| `LCD`          | `Primary Readout`          |
| `reset button` | `All Clear (AC)`           |
| `backspace`    | `Clear Entry (CE)`         |
| `numpad`       | `Standard Keypad`          |
| `chatbot`      | `Expression Translator`    |
| `AI assistant` | `Expression Translator`    |
| `AI box`       | `Natural Language Input`   |
