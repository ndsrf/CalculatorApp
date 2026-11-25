# Personas

Every specification in `openspec/specs/` MUST reference valid `@persona:` tags defined here. `scripts/lint-docs.ts` enforces that no undefined persona tags appear in specs.

## `@persona:casual-user`

- **Primary Workflow:** Uses the **Standard Keypad** (`0`–`9`, operators, `equals`, `Clear Entry (CE)`, `All Clear (AC)`).
- **Secondary Workflow:** Asks questions in everyday words through the **Natural Language Input** (for example, `15% of 80, plus 5`) instead of building the expression by hand.
- **Goals:** Perform quick, step-by-step arithmetic without remembering operator precedence or keyboard syntax.
- **Communication Expectations:** Plain-language feedback with zero internal DOM selectors, CSS attributes, or raw JSON jargon.

## `@persona:power-user`

- **Primary Workflow:** Uses the **Expression Input** and **Submit Expression** control to evaluate multi-step parenthesized arithmetic expressions (for example, `(12 + 8) / 4`).
- **Goals:** Enter complete expressions rapidly, verify exact operator precedence, and recover cleanly from syntax mistakes using `Clear Entry (CE)` or `All Clear (AC)`.
- **Trust Expectation:** When using the **Natural Language Input**, wants to see the exact translated expression in the **Expression Input** before trusting the result.
- **Communication Expectations:** Concise, accurate feedback referencing canonical terms (`Expression Input`, `Primary Readout`, `All Clear (AC)`).
