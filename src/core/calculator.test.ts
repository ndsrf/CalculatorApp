import { describe, expect, it } from 'vitest';
import {
  applyTranslation,
  createInitialState,
  DIVISION_BY_ZERO_MESSAGE,
  getCalculatorPhase,
  INVALID_EXPRESSION_MESSAGE,
  pressAllClear,
  pressClearEntry,
  pressDigit,
  pressEquals,
  pressOperator,
  setExpressionInput,
  setNaturalLanguageInput,
  submitExpression,
  TRANSLATION_FAILED_MESSAGE,
} from './calculator.ts';
import { checkExpressionSyntax } from './parser.ts';

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

  it('tracks runtime CalculatorPhase transitions matching the generated state chart', () => {
    let state = createInitialState();
    expect(getCalculatorPhase(state)).toBe('Idle');

    state = pressDigit(state, '9');
    expect(getCalculatorPhase(state)).toBe('EnteringDigit');

    state = pressClearEntry(state);
    expect(getCalculatorPhase(state)).toBe('Idle');

    state = pressDigit(state, '9');
    state = pressOperator(state, 'divide');
    expect(getCalculatorPhase(state)).toBe('PendingOp');

    state = pressDigit(state, '4');
    expect(getCalculatorPhase(state)).toBe('EnteringDigit');

    state = pressClearEntry(state);
    expect(getCalculatorPhase(state)).toBe('PendingOp');

    state = pressDigit(state, '0');
    state = pressEquals(state);
    expect(getCalculatorPhase(state)).toBe('ErrorState');

    state = pressAllClear();
    expect(getCalculatorPhase(state)).toBe('Idle');
  });

  it('writes a translated expression into Expression Input and evaluates it with the safe parser', () => {
    let state = setNaturalLanguageInput(createInitialState(), '15% of 80, plus 5');
    state = applyTranslation(state, { status: 'translated', expression: '15 / 100 * 80 + 5' });

    expect(state.expressionInput).toBe('15 / 100 * 80 + 5');
    expect(state.naturalLanguageInput).toBe('15% of 80, plus 5');
    expect(state.display).toBe('17');
    expect(state.errorState).toBe(false);
  });

  it('never trusts translated text: malformed or malicious expressions enter errorState', () => {
    const malicious = applyTranslation(createInitialState(), {
      status: 'translated',
      expression: 'process.exit(1)',
    });
    expect(malicious.errorState).toBe(true);
    expect(malicious.display).toBe(INVALID_EXPRESSION_MESSAGE);

    const divByZero = applyTranslation(createInitialState(), {
      status: 'translated',
      expression: '10 / 0',
    });
    expect(divByZero.display).toBe(DIVISION_BY_ZERO_MESSAGE);
  });

  it('enters errorState on a failed translation, locks further input, and recovers on AC', () => {
    const previous = applyTranslation(createInitialState(), {
      status: 'translated',
      expression: '9 / 2 + 1',
    });
    let state = applyTranslation(previous, { status: 'failed' });
    expect(state.errorState).toBe(true);
    expect(state.expressionInput).toBe('');
    expect(state.display).toBe(TRANSLATION_FAILED_MESSAGE);
    expect(getCalculatorPhase(state)).toBe('ErrorState');

    expect(setNaturalLanguageInput(state, 'what is 2 plus 2')).toEqual(state);
    expect(applyTranslation(state, { status: 'translated', expression: '2 + 2' })).toEqual(state);

    state = pressAllClear();
    expect(state).toEqual(createInitialState());
  });

  it('clears Natural Language Input on CE without touching the pending accumulator', () => {
    let state = pressDigit(createInitialState(), '9');
    state = pressOperator(state, 'add');
    state = setNaturalLanguageInput(state, 'half of 9 plus 1');
    state = pressClearEntry(state);

    expect(state.naturalLanguageInput).toBe('');
    expect(state.accumulator).toBe(9);
    expect(state.pendingOp).toBe('add');
  });

  it('treats division by zero as well-formed syntax but rejects malformed expressions', () => {
    expect(checkExpressionSyntax('(12 + 8) / 4')).toEqual({ ok: true });
    expect(checkExpressionSyntax('10 / 0')).toEqual({ ok: true });
    expect(checkExpressionSyntax('9 / 2 + 1 = 5.5')).toMatchObject({ ok: false });
    expect(checkExpressionSyntax('process.exit(1)')).toMatchObject({ ok: false });
  });
});
