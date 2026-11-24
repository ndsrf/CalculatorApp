# Specification: Error Handling

- **Feature Map Section:** `error-handling`
- **Personas:** `@persona:casual-user`, `@persona:power-user`

## Purpose
Ensure deterministic, safe recovery whenever an invalid arithmetic operation or malformed expression occurs across either the **Standard Keypad** or the **Expression Input**.

## Requirements

### Requirement: Division by Zero Enters Error State
Dividing by zero via either the **Standard Keypad** or the **Expression Input** SHALL transition the calculator into **Error State** (`errorState = true`), display `"Cannot divide by zero"` in the **Primary Readout**, and disable all operator keys until **All Clear (AC)** is activated.

#### Scenario: Division by zero via Standard Keypad
- **GIVEN** `@persona:casual-user` is using the **Standard Keypad**
- **WHEN** `@persona:casual-user` presses `8`, `divide`, `0`, `equals`
- **THEN** the **Primary Readout** displays `"Cannot divide by zero"`
- **AND** `errorState` is `true`
- **AND** operator keys (`add`, `subtract`, `multiply`, `divide`) are disabled and ignored until **All Clear (AC)** is pressed

#### Scenario: Division by zero via Expression Input
- **GIVEN** `@persona:power-user` is using the **Expression Input**
- **WHEN** `@persona:power-user` submits `10 / (5 - 5)` via **Submit Expression**
- **THEN** the **Primary Readout** displays `"Cannot divide by zero"`
- **AND** `errorState` is `true`
- **AND** operator keys remain disabled until **All Clear (AC)** is pressed

### Requirement: Invalid Syntax in Expression Input
Submitting empty, unbalanced, or syntactically invalid text in the **Expression Input** SHALL enter **Error State** without throwing uncaught runtime exceptions or producing `NaN`.

#### Scenario: Malformed expression submission
- **GIVEN** `@persona:power-user` enters `2 + * 3` or `(4 + 5` in the **Expression Input**
- **WHEN** `@persona:power-user` activates **Submit Expression**
- **THEN** the **Primary Readout** displays `"Invalid expression"`
- **AND** `errorState` is `true`
- **AND** operator keys remain disabled until **All Clear (AC)** is pressed

### Requirement: Recovery via All Clear (AC)
The **Primary Readout** SHALL NEVER display `NaN`, `Infinity`, or `-Infinity`. Pressing **All Clear (AC)** SHALL always exit **Error State** cleanly.

#### Scenario: Recover from Error State
- **GIVEN** the calculator is in **Error State**
- **WHEN** `@persona:casual-user` or `@persona:power-user` activates **All Clear (AC)**
- **THEN** `errorState` becomes `false`, operator keys are re-enabled, and the **Primary Readout** displays `"0"`
