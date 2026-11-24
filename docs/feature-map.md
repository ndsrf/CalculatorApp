# Feature Map

This document is the single source of truth mapping user-facing features to:

1. Their 1:1 living specification folder in `openspec/specs/<section>/spec.md`.
2. Their exact DOM selectors enforced by `src/ui/` and verified by `tools/calc-verify/`.

---

## `keypad` — Standard Keypad

**Spec:** [`openspec/specs/keypad/spec.md`](../openspec/specs/keypad/spec.md)  
**Primary Persona:** `@persona:casual-user`

| Feature Name      | CLI Key / Action  | DOM Selector             |
| ----------------- | ----------------- | ------------------------ |
| Primary Readout   | `display-current` | `#display-current`       |
| Digit 0           | `0`               | `[data-key="0"]`         |
| Digit 1           | `1`               | `[data-key="1"]`         |
| Digit 2           | `2`               | `[data-key="2"]`         |
| Digit 3           | `3`               | `[data-key="3"]`         |
| Digit 4           | `4`               | `[data-key="4"]`         |
| Digit 5           | `5`               | `[data-key="5"]`         |
| Digit 6           | `6`               | `[data-key="6"]`         |
| Digit 7           | `7`               | `[data-key="7"]`         |
| Digit 8           | `8`               | `[data-key="8"]`         |
| Digit 9           | `9`               | `[data-key="9"]`         |
| Add Operator      | `add`             | `[data-op="add"]`        |
| Subtract Operator | `subtract`        | `[data-op="subtract"]`   |
| Multiply Operator | `multiply`        | `[data-op="multiply"]`   |
| Divide Operator   | `divide`          | `[data-op="divide"]`     |
| Equals            | `equals`          | `[data-action="equals"]` |
| Clear Entry (CE)  | `ce`              | `[data-action="ce"]`     |
| All Clear (AC)    | `ac`              | `[data-action="ac"]`     |

---

## `expression-input` — Expression Input

**Spec:** [`openspec/specs/expression-input/spec.md`](../openspec/specs/expression-input/spec.md)  
**Primary Persona:** `@persona:power-user`

| Feature Name      | CLI Key / Action    | DOM Selector                        |
| ----------------- | ------------------- | ----------------------------------- |
| Expression Input  | `expression-input`  | `#expression-input`                 |
| Submit Expression | `submit-expression` | `[data-action="submit-expression"]` |

---

## `error-handling` — Error Handling

**Spec:** [`openspec/specs/error-handling/spec.md`](../openspec/specs/error-handling/spec.md)  
**Primary Personas:** `@persona:casual-user`, `@persona:power-user`

Error states render in the **Primary Readout** (`#display-current`), disable operator keys (`[data-op="add"]`, `[data-op="subtract"]`, `[data-op="multiply"]`, `[data-op="divide"]`), and recover exclusively when **All Clear (AC)** (`[data-action="ac"]`) is activated.
