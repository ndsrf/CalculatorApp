import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  DIVISION_BY_ZERO_MESSAGE,
  INVALID_EXPRESSION_MESSAGE,
  pressAllClear,
  pressClearEntry,
  pressDigit,
  pressEquals,
  pressOperator,
  setExpressionInput,
  submitExpression,
} from './calculator.ts';

describe('calculator state machine', () => {
  it('performs basic keypad arithmetic', () => {
    let state = createInitialState();
    state = pressDigit(state, '1');
    state = pressDigit(state, '2');
    state = pressOperator(state, 'add');
    state = pressDigit(state, '8');
    state = pressEquals(state);

    expect(state.display).toBe('20');
    expect(state.errorState).toBe(false);
  });

  it('preserves pending accumulator on CE, allows switching operator without false divide-by-zero, and resets all state on AC', () => {
    let state = createInitialState();
    state = pressDigit(state, '9');
    state = pressOperator(state, 'divide');
    state = pressDigit(state, '4');
    state = pressClearEntry(state);

    expect(state.display).toBe('0');
    expect(state.accumulator).toBe(9);
    expect(state.pendingOp).toBe('divide');

    state = pressOperator(state, 'add');
    expect(state.errorState).toBe(false);
    expect(state.accumulator).toBe(9);
    expect(state.pendingOp).toBe('add');

    state = pressDigit(state, '3');
    state = pressEquals(state);
    expect(state.display).toBe('12');

    state = pressAllClear();
    expect(state).toEqual(createInitialState());
  });

  it('preserves exact safe integers of 13+ digits and caps keypad entry length without entering errorState', () => {
    let state = createInitialState();
    state = setExpressionInput(state, '1234567890123 + 0');
    state = submitExpression(state);
    expect(state.display).toBe('1234567890123');

    state = pressAllClear();
    for (let i = 0; i < 20; i += 1) {
      state = pressDigit(state, '9');
    }
    expect(state.errorState).toBe(false);
    expect(state.display).toBe('9'.repeat(15));
  });

  it('enters errorState on keypad division by zero and ignores operators and Expression Input edits until AC', () => {
    let state = createInitialState();
    state = pressDigit(state, '8');
    state = pressOperator(state, 'divide');
    state = pressDigit(state, '0');
    state = pressEquals(state);

    expect(state.errorState).toBe(true);
    expect(state.display).toBe(DIVISION_BY_ZERO_MESSAGE);

    expect(pressOperator(state, 'add')).toEqual(state);
    expect(setExpressionInput(state, '2 + 2')).toEqual(state);

    const afterAc = pressAllClear();
    expect(afterAc.errorState).toBe(false);
    expect(afterAc.display).toBe('0');
  });

  it('evaluates valid Expression Input and enters errorState on division by zero or invalid syntax', () => {
    let state = createInitialState();
    state = setExpressionInput(state, '(10 + 5) * 2');
    state = submitExpression(state);
    expect(state.display).toBe('30');
    expect(state.errorState).toBe(false);

    state = setExpressionInput(state, '10 / (5 - 5)');
    state = submitExpression(state);
    expect(state.errorState).toBe(true);
    expect(state.display).toBe(DIVISION_BY_ZERO_MESSAGE);

    state = pressAllClear();
    state = setExpressionInput(state, '2 + * 3');
    state = submitExpression(state);
    expect(state.errorState).toBe(true);
    expect(state.display).toBe(INVALID_EXPRESSION_MESSAGE);
  });
});
