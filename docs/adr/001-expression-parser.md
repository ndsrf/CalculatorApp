# ADR 001: Safe Custom Expression Parser Instead of `eval()`

## Status

Accepted

## Context

The Calculator App supports an **Expression Input** (`#expression-input`) that evaluates arithmetic expressions containing `+`, `-`, `*`, `/`, decimals, unary signs, and nested parentheses. Using JavaScript's `eval()` or `new Function()` would be trivial to implement, but introduces severe security, correctness, and determinism risks:

1. **Code Injection / XSS:** Arbitrary JavaScript passed into `Expression Input` would execute in the browser context.
2. **Non-Arithmetic Edge Cases:** JavaScript coerces non-numeric strings, returns `Infinity` or `NaN` silently on division by zero (`1 / 0 === Infinity`, `0 / 0 === NaN`), and accepts statements or object literals that are invalid math.
3. **Opaque Errors:** Native JS syntax errors leak runtime internals instead of deterministic domain errors required by `openspec/specs/error-handling/spec.md`.

## Decision

Implement a pure, zero-dependency tokenizer and recursive-descent parser in `src/core/parser.ts` that:

- Accepts only numeric literals, `+`, `-`, `*`, `/`, unary `+`/`-`, parentheses `(` `)`, and whitespace.
- Enforces standard operator precedence (`()` > unary > `*`/`/` > `+`/`-`) with left-to-right associativity.
- Explicitly throws a typed division-by-zero error whenever a divisor evaluates to `0`.
- Rejects malformed tokens, unbalanced parentheses, trailing tokens, and empty input with a typed syntax error.
- Never returns `NaN`, `Infinity`, or `-Infinity`.

## Consequences

- **Positive:** Completely eliminates code-injection risk, guarantees deterministic error messages, and enables exhaustive property-based and model-based testing with `fast-check`.
- **Trade-off:** Adding future math functions (e.g., `sqrt`, `^`) requires extending the grammar explicitly in `src/core/parser.ts` and updating specs accordingly.
