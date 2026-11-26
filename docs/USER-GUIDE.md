# Calculator App User Guide (v1.0.0)

> Auto-generated from `docs/feature-map.md`, `docs/glossary.md`, and `openspec/specs/` via `npm run docs:generate`. Do not edit manually.

## Using the Calculator

- **Standard Keypad:** Tap digits `0`–`9` and operators (`+`, `-`, `*`, `/`), then press **Equals** to evaluate. Use **Clear Entry (CE)** to clear the current entry or **All Clear (AC)** to reset everything.
- **Expression Input:** Type full parenthesized arithmetic expressions (for example, `(12 + 8) / 4`) and press **Submit Expression**.
- **Natural Language Input:** Ask an arithmetic question in everyday words (for example, `15% of 80, plus 5`) and press **Translate Question**. The **Expression Translator** writes the expression into the **Expression Input** and displays the result in the **Primary Readout**.
- **Error State Recovery:** If an invalid operation occurs (such as division by zero, a syntax error, or a **Translation Refusal**), the **Primary Readout** shows an error message and locks operators until you press **All Clear (AC)**.

## Specified Capabilities

- **error-handling:** Ensure deterministic, safe recovery whenever an invalid arithmetic operation, malformed expression, or failed translation occurs across the **Standard Keypad**, the **Expression Input**, or the **Natural Language Input**.
- **expression-input:** Allow a `@persona:power-user` to type complete arithmetic expressions into the **Expression Input** (`#expression-input`) and evaluate them safely via **Submit Expression** (`[data-action="submit-expression"]`) without relying on JavaScript `eval()`.
- **keypad:** Provide a responsive **Standard Keypad** that enables a `@persona:casual-user` to enter numbers and execute step-by-step arithmetic operations with immediate updates to the **Primary Readout**.
- **natural-language-input:** Let a `@persona:casual-user` ask an arithmetic question in everyday words through the **Natural Language Input** (`#natural-language-input`). The **Expression Translator** converts the question into an expression, and the safe parser evaluates it. The model never computes the result, and its output is never trusted without validation.
