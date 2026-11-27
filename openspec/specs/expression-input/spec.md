# Specification: Expression Input

- **Feature Map Section:** `expression-input`
- **Personas:** `@persona:power-user`

## Purpose

Allow a `@persona:power-user` to type complete arithmetic expressions into the **Expression Input** (`#expression-input`) and evaluate them safely via **Submit Expression** (`[data-action="submit-expression"]`) without relying on JavaScript `eval()`.

## Requirements

### Requirement: Safe Parenthesized Expression Evaluation

The calculator SHALL parse and evaluate arithmetic expressions containing `+`, `-`, `*`, `/`, numeric literals, unary signs, and nested parentheses using the custom parser documented in `docs/adr/001-expression-parser.md`.

#### Scenario: Operator precedence and parentheses

- **GIVEN** the calculator is ready
- **WHEN** `@persona:power-user` enters `(10 + 5) * 2 - 4 / 2` in the **Expression Input** and activates **Submit Expression**
- **THEN** the **Primary Readout** displays `"28"`

#### Scenario: Negative unary operands

- **GIVEN** the calculator is ready
- **WHEN** `@persona:power-user` enters `-6 + (3 * 4)` in the **Expression Input** and activates **Submit Expression**
- **THEN** the **Primary Readout** displays `"6"`

### Requirement: Clearing Expression Input

**Clear Entry (CE)** and **All Clear (AC)** SHALL keep **Expression Input** synchronized with calculator state.

#### Scenario: Clear Entry (CE) clears active Expression Input

- **GIVEN** `@persona:power-user` has typed `2 + 2` into the **Expression Input**
- **WHEN** `@persona:power-user` activates **Clear Entry (CE)**
- **THEN** the **Expression Input** is emptied and the **Primary Readout** resets to `"0"` without erasing an unrelated pending accumulator

#### Scenario: All Clear (AC) resets Expression Input and Primary Readout

- **GIVEN** `@persona:power-user` has typed an expression or triggered an **Error State**
- **WHEN** `@persona:power-user` activates **All Clear (AC)**
- **THEN** the **Expression Input** is emptied, the **Primary Readout** displays `"0"`, and normal operation resumes

### Requirement: Canonical Control Names

The accessible names of `#expression-input` and `[data-action="submit-expression"]` SHALL be **Expression Input** and **Submit Expression**, as listed in `docs/feature-map.md`.

#### Scenario: Controls are found by name

- **GIVEN** the calculator is ready
- **WHEN** `@persona:power-user` looks for **Submit Expression** by name
- **THEN** the button carrying that name is `[data-action="submit-expression"]` and shows it as its label
