# Specification: Standard Keypad

- **Feature Map Section:** `keypad`
- **Personas:** `@persona:casual-user`

## Purpose

Provide a responsive **Standard Keypad** that enables a `@persona:casual-user` to enter numbers and execute step-by-step arithmetic operations with immediate updates to the **Primary Readout**.

## Requirements

### Requirement: Digit Entry

The calculator SHALL accept digits `0` through `9` via `[data-key="0"]` through `[data-key="9"]` and update the **Primary Readout** (`#display-current`).

#### Scenario: Initial digit replaces leading zero

- **GIVEN** the calculator is in its initial state with `"0"` in the **Primary Readout**
- **WHEN** `@persona:casual-user` presses `7` then `3`
- **THEN** the **Primary Readout** displays `"73"`

#### Scenario: Repeated leading zeros collapse

- **GIVEN** the **Primary Readout** displays `"0"`
- **WHEN** `@persona:casual-user` presses `0` multiple times
- **THEN** the **Primary Readout** remains `"0"`

### Requirement: Binary Arithmetic Operators & Equals

The calculator SHALL support `add` (`[data-op="add"]`), `subtract` (`[data-op="subtract"]`), `multiply` (`[data-op="multiply"]`), `divide` (`[data-op="divide"]`), and `equals` (`[data-action="equals"]`).

#### Scenario: Basic addition

- **GIVEN** the calculator is in a clean state
- **WHEN** `@persona:casual-user` presses `1`, `2`, `add`, `8`, `equals`
- **THEN** the **Primary Readout** displays `"20"`

#### Scenario: Chained operations evaluate left-to-right

- **GIVEN** the calculator is in a clean state
- **WHEN** `@persona:casual-user` presses `5`, `add`, `3`, `multiply`, `2`, `equals`
- **THEN** the intermediate sum `"8"` is multiplied by `2` and the **Primary Readout** displays `"16"`

### Requirement: Clear Entry (CE) vs All Clear (AC)

The calculator SHALL distinguish between **Clear Entry (CE)** (`[data-action="ce"]`) and **All Clear (AC)** (`[data-action="ac"]`).

#### Scenario: Clear Entry (CE) preserves pending calculation

- **GIVEN** `@persona:casual-user` has pressed `9`, `add`, `4`
- **WHEN** `@persona:casual-user` presses **Clear Entry (CE)**, then `5`, then `equals`
- **THEN** the **Primary Readout** displays `"14"`

#### Scenario: All Clear (AC) resets full state

- **GIVEN** `@persona:casual-user` has entered `9`, `add`, `4`
- **WHEN** `@persona:casual-user` presses **All Clear (AC)**
- **THEN** the **Primary Readout** displays `"0"`, the pending accumulator and operator are cleared, and `errorState` is `false`
