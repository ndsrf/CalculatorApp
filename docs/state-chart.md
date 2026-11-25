# Calculator State Chart

> Auto-generated from `CALCULATOR_STATE_TRANSITIONS` in [`src/core/calculator.ts`](../src/core/calculator.ts) via `npm run docs:state-chart`. Do not edit manually.

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> EnteringDigit: pressDigit (0-9)
    Idle --> PendingOp: pressOperator (+,-,*,/)
    Idle --> Idle: submitExpression (valid) / applyTranslation (valid) / pressClearEntry (CE) / pressAllClear (AC)
    Idle --> ErrorState: submitExpression or applyTranslation (div-by-zero / syntax error) / applyTranslation (failed)
    EnteringDigit --> EnteringDigit: pressDigit (0-9)
    EnteringDigit --> PendingOp: pressOperator (+,-,*,/) / pressClearEntry (CE with pendingOp)
    EnteringDigit --> Idle: pressEquals (valid) / submitExpression or applyTranslation (valid) / pressClearEntry (CE without pendingOp) / pressAllClear (AC)
    EnteringDigit --> ErrorState: pressEquals or pressOperator (div-by-zero) / submitExpression (error) / applyTranslation (error or failed)
    PendingOp --> EnteringDigit: pressDigit (0-9)
    PendingOp --> PendingOp: pressOperator (switch op) / pressClearEntry (CE)
    PendingOp --> Idle: pressEquals (valid) / submitExpression or applyTranslation (valid) / pressAllClear (AC)
    PendingOp --> ErrorState: pressEquals (div-by-zero) / submitExpression (error) / applyTranslation (error or failed)
    ErrorState --> ErrorState: pressDigit / pressOperator / pressEquals / CE / submitExpression / applyTranslation (locked)
    ErrorState --> Idle: pressAllClear (AC)
```
