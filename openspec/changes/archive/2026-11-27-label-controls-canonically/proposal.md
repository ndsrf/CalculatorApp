# Proposal: Label Controls with Canonical Names

## Why

The submit and translate buttons read **Run** and **Ask**, while the Feature Map, specs, and generated User Guide call them **Submit Expression** and **Translate Question**. A user following the User Guide cannot find them, and no check noticed the drift.

## What Changes

- Both buttons show their canonical names.
- A browser test asserts that the accessible name of each text control matches its Feature Map name.

## Non-Goals

- Renaming keypad symbols (`÷`, `AC`, `=`).
- Selector or state-transition changes.

## Impact

- Specs: `expression-input`, `natural-language-input`.
- UI template and styles, one new test.
