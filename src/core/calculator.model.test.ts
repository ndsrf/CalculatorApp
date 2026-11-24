import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type CalculatorState,
  createInitialState,
  type Digit,
  DIVISION_BY_ZERO_MESSAGE,
  type Operator,
  pressAllClear,
  pressClearEntry,
  pressDigit,
  pressEquals,
  pressOperator,
  setExpressionInput,
  submitExpression,
} from './calculator.ts';
import { DivisionByZeroError, evaluateExpression } from './parser.ts';

interface ReferenceModel {
  errorState: boolean;
}

class CalculatorSystem {
  state: CalculatorState = createInitialState();
}

function assertInvariants(state: CalculatorState): void {
  expect(state.display).not.toContain('NaN');
  expect(state.display).not.toContain('Infinity');
  expect(state.display.length).toBeGreaterThan(0);

  if (!state.errorState) {
    const parsed = Number(state.display);
    expect(Number.isFinite(parsed)).toBe(true);
  }
}

class DigitCommand implements fc.Command<ReferenceModel, CalculatorSystem> {
  constructor(readonly digit: Digit) {}

  check(): boolean {
    return true;
  }

  run(model: ReferenceModel, sys: CalculatorSystem): void {
    const before = sys.state;
    sys.state = pressDigit(sys.state, this.digit);
    assertInvariants(sys.state);

    if (model.errorState) {
      expect(sys.state).toEqual(before);
    } else {
      model.errorState = sys.state.errorState;
    }
  }

  toString(): string {
    return `pressDigit(${this.digit})`;
  }
}

class OperatorCommand implements fc.Command<ReferenceModel, CalculatorSystem> {
  constructor(readonly op: Operator) {}

  check(): boolean {
    return true;
  }

  run(model: ReferenceModel, sys: CalculatorSystem): void {
    const before = sys.state;
    const willDivideByZero =
      !before.errorState &&
      before.accumulator !== null &&
      before.pendingOp === 'divide' &&
      !before.waitingForOperand &&
      Number(before.display) === 0;

    sys.state = pressOperator(sys.state, this.op);
    assertInvariants(sys.state);

    if (model.errorState) {
      expect(sys.state).toEqual(before);
      expect(sys.state.errorState).toBe(true);
      return;
    }

    if (willDivideByZero) {
      expect(sys.state.errorState).toBe(true);
      expect(sys.state.display).toBe(DIVISION_BY_ZERO_MESSAGE);
    }

    model.errorState = sys.state.errorState;
  }

  toString(): string {
    return `pressOperator(${this.op})`;
  }
}

class EqualsCommand implements fc.Command<ReferenceModel, CalculatorSystem> {
  check(): boolean {
    return true;
  }

  run(model: ReferenceModel, sys: CalculatorSystem): void {
    const before = sys.state;
    const willDivideByZero =
      !before.errorState &&
      before.accumulator !== null &&
      before.pendingOp === 'divide' &&
      Number(before.display) === 0;

    sys.state = pressEquals(sys.state);
    assertInvariants(sys.state);

    if (model.errorState) {
      expect(sys.state).toEqual(before);
      return;
    }

    if (willDivideByZero) {
      expect(sys.state.errorState).toBe(true);
      expect(sys.state.display).toBe(DIVISION_BY_ZERO_MESSAGE);
    }

    model.errorState = sys.state.errorState;
  }

  toString(): string {
    return 'pressEquals()';
  }
}

class ClearEntryCommand implements fc.Command<ReferenceModel, CalculatorSystem> {
  check(): boolean {
    return true;
  }

  run(model: ReferenceModel, sys: CalculatorSystem): void {
    const before = sys.state;
    sys.state = pressClearEntry(sys.state);
    assertInvariants(sys.state);

    if (model.errorState) {
      expect(sys.state).toEqual(before);
      return;
    }

    expect(sys.state.display).toBe('0');
    expect(sys.state.expressionInput).toBe('');
    expect(sys.state.accumulator).toBe(before.accumulator);
    expect(sys.state.pendingOp).toBe(before.pendingOp);
    expect(sys.state.waitingForOperand).toBe(before.pendingOp !== null);
  }

  toString(): string {
    return 'pressClearEntry(CE)';
  }
}

class AllClearCommand implements fc.Command<ReferenceModel, CalculatorSystem> {
  check(): boolean {
    return true;
  }

  run(model: ReferenceModel, sys: CalculatorSystem): void {
    sys.state = pressAllClear();
    assertInvariants(sys.state);

    expect(sys.state).toEqual(createInitialState());
    model.errorState = false;
  }

  toString(): string {
    return 'pressAllClear(AC)';
  }
}

class SubmitExpressionCommand implements fc.Command<ReferenceModel, CalculatorSystem> {
  constructor(readonly expression: string) {}

  check(): boolean {
    return true;
  }

  run(model: ReferenceModel, sys: CalculatorSystem): void {
    const before = sys.state;
    sys.state = setExpressionInput(sys.state, this.expression);
    sys.state = submitExpression(sys.state);
    assertInvariants(sys.state);

    if (model.errorState) {
      expect(sys.state).toEqual(before);
      return;
    }

    let expectedDivByZero = false;
    let expectedError = false;
    try {
      evaluateExpression(this.expression);
    } catch (error) {
      expectedError = true;
      if (error instanceof DivisionByZeroError) {
        expectedDivByZero = true;
      }
    }

    if (expectedDivByZero) {
      expect(sys.state.errorState).toBe(true);
      expect(sys.state.display).toBe(DIVISION_BY_ZERO_MESSAGE);
    } else if (expectedError) {
      expect(sys.state.errorState).toBe(true);
    } else {
      expect(sys.state.errorState).toBe(false);
    }

    model.errorState = sys.state.errorState;
  }

  toString(): string {
    return `submitExpression(${JSON.stringify(this.expression)})`;
  }
}

const digitArb = fc.constantFrom<Digit>('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
const opArb = fc.constantFrom<Operator>('add', 'subtract', 'multiply', 'divide');
const expressionArb = fc.oneof(
  fc.constant('12 + 8'),
  fc.constant('(10 + 5) * 2 - 4 / 2'),
  fc.constant('-6 + (3 * 4)'),
  fc.constant('8 / 0'),
  fc.constant('10 / (5 - 5)'),
  fc.constant('0 / 0'),
  fc.constant('2 + * 3'),
  fc.constant('(4 + 5'),
  fc.constant(''),
  fc
    .tuple(
      fc.integer({ min: -50, max: 50 }),
      fc.constantFrom('+', '-', '*', '/'),
      fc.integer({ min: -10, max: 10 }),
    )
    .map(([a, op, b]) => `(${a}) ${op} (${b})`),
);

const allCommands = [
  digitArb.map((d) => new DigitCommand(d)),
  opArb.map((op) => new OperatorCommand(op)),
  fc.constant(new EqualsCommand()),
  fc.constant(new ClearEntryCommand()),
  fc.constant(new AllClearCommand()),
  expressionArb.map((expr) => new SubmitExpressionCommand(expr)),
];

describe('calculator model-based state machine tests (fast-check)', () => {
  it('upholds all invariants across randomized keypad, CE, AC, and Expression Input sequences', () => {
    fc.assert(
      fc.property(fc.commands(allCommands, { maxCommands: 40 }), (cmds) => {
        const setup = () => ({
          model: { errorState: false },
          real: new CalculatorSystem(),
        });
        fc.modelRun(setup, cmds);
      }),
      { numRuns: 200 },
    );
  });
});
