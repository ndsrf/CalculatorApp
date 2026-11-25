import {
  checkExpressionSyntax,
  DIVISION_BY_ZERO_MESSAGE,
  DivisionByZeroError,
  evaluateExpression,
  INVALID_EXPRESSION_MESSAGE,
} from './parser.ts';

export { checkExpressionSyntax, DIVISION_BY_ZERO_MESSAGE, INVALID_EXPRESSION_MESSAGE };
export type { ExpressionCheck } from './parser.ts';

export const TRANSLATION_FAILED_MESSAGE = 'Could not translate question';

export type TranslationOutcome =
  { status: 'translated'; expression: string } | { status: 'failed' };

export type Operator = 'add' | 'subtract' | 'multiply' | 'divide';
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type CalculatorPhase = 'Idle' | 'EnteringDigit' | 'PendingOp' | 'ErrorState';

export interface CalculatorTransition {
  from: CalculatorPhase;
  to: CalculatorPhase;
  event: string;
}

export const CALCULATOR_STATE_TRANSITIONS: readonly CalculatorTransition[] = [
  { from: 'Idle', to: 'EnteringDigit', event: 'pressDigit (0-9)' },
  { from: 'Idle', to: 'PendingOp', event: 'pressOperator (+,-,*,/)' },
  {
    from: 'Idle',
    to: 'Idle',
    event:
      'submitExpression (valid) / applyTranslation (valid) / pressClearEntry (CE) / pressAllClear (AC)',
  },
  {
    from: 'Idle',
    to: 'ErrorState',
    event:
      'submitExpression or applyTranslation (div-by-zero / syntax error) / applyTranslation (failed)',
  },
  { from: 'EnteringDigit', to: 'EnteringDigit', event: 'pressDigit (0-9)' },
  {
    from: 'EnteringDigit',
    to: 'PendingOp',
    event: 'pressOperator (+,-,*,/) / pressClearEntry (CE with pendingOp)',
  },
  {
    from: 'EnteringDigit',
    to: 'Idle',
    event:
      'pressEquals (valid) / submitExpression or applyTranslation (valid) / pressClearEntry (CE without pendingOp) / pressAllClear (AC)',
  },
  {
    from: 'EnteringDigit',
    to: 'ErrorState',
    event:
      'pressEquals or pressOperator (div-by-zero) / submitExpression (error) / applyTranslation (error or failed)',
  },
  { from: 'PendingOp', to: 'EnteringDigit', event: 'pressDigit (0-9)' },
  { from: 'PendingOp', to: 'PendingOp', event: 'pressOperator (switch op) / pressClearEntry (CE)' },
  {
    from: 'PendingOp',
    to: 'Idle',
    event:
      'pressEquals (valid) / submitExpression or applyTranslation (valid) / pressAllClear (AC)',
  },
  {
    from: 'PendingOp',
    to: 'ErrorState',
    event:
      'pressEquals (div-by-zero) / submitExpression (error) / applyTranslation (error or failed)',
  },
  {
    from: 'ErrorState',
    to: 'ErrorState',
    event:
      'pressDigit / pressOperator / pressEquals / CE / submitExpression / applyTranslation (locked)',
  },
  { from: 'ErrorState', to: 'Idle', event: 'pressAllClear (AC)' },
];

export function getCalculatorPhase(state: CalculatorState): CalculatorPhase {
  if (state.errorState) {
    return 'ErrorState';
  }
  if (state.pendingOp !== null && state.waitingForOperand) {
    return 'PendingOp';
  }
  if (state.display === '0' && state.pendingOp === null && !state.waitingForOperand) {
    return 'Idle';
  }
  if (state.waitingForOperand && state.pendingOp === null) {
    return 'Idle';
  }
  return 'EnteringDigit';
}

const MAX_KEYPAD_DIGITS = 15;

export interface CalculatorState {
  display: string;
  accumulator: number | null;
  pendingOp: Operator | null;
  expressionInput: string;
  naturalLanguageInput: string;
  errorState: boolean;
  waitingForOperand: boolean;
}

export function createInitialState(): CalculatorState {
  return {
    display: '0',
    accumulator: null,
    pendingOp: null,
    expressionInput: '',
    naturalLanguageInput: '',
    errorState: false,
    waitingForOperand: false,
  };
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Cannot format non-finite number');
  }
  const normalized = Object.is(value, -0) ? 0 : value;
  if (Number.isSafeInteger(normalized)) {
    return normalized.toString();
  }
  return Number(normalized.toPrecision(12)).toString();
}

function enterErrorState(state: CalculatorState, message: string): CalculatorState {
  return {
    ...state,
    display: message,
    accumulator: null,
    pendingOp: null,
    errorState: true,
    waitingForOperand: false,
  };
}

function applyOperation(left: number, right: number, op: Operator): number {
  switch (op) {
    case 'add':
      return left + right;
    case 'subtract':
      return left - right;
    case 'multiply':
      return left * right;
    case 'divide':
      if (right === 0) {
        throw new DivisionByZeroError();
      }
      return left / right;
  }
}

function evaluateTransition(
  state: CalculatorState,
  compute: () => number,
  onSuccess: (result: number) => CalculatorState,
): CalculatorState {
  try {
    const result = compute();
    if (!Number.isFinite(result)) {
      return enterErrorState(state, INVALID_EXPRESSION_MESSAGE);
    }
    return onSuccess(result);
  } catch (error) {
    if (error instanceof DivisionByZeroError) {
      return enterErrorState(state, DIVISION_BY_ZERO_MESSAGE);
    }
    return enterErrorState(state, INVALID_EXPRESSION_MESSAGE);
  }
}

export function pressDigit(state: CalculatorState, digit: Digit): CalculatorState {
  if (state.errorState) {
    return state;
  }

  if (state.waitingForOperand) {
    return {
      ...state,
      display: digit,
      waitingForOperand: false,
    };
  }

  const nextDisplay = state.display === '0' ? digit : `${state.display}${digit}`;
  if (nextDisplay.length > MAX_KEYPAD_DIGITS) {
    return state;
  }

  return {
    ...state,
    display: nextDisplay,
  };
}

export function pressOperator(state: CalculatorState, op: Operator): CalculatorState {
  if (state.errorState) {
    return state;
  }

  const currentValue = Number(state.display);
  if (!Number.isFinite(currentValue)) {
    return enterErrorState(state, INVALID_EXPRESSION_MESSAGE);
  }

  if (state.accumulator !== null && state.pendingOp !== null && !state.waitingForOperand) {
    const pendingOp = state.pendingOp;
    const accumulator = state.accumulator;
    return evaluateTransition(
      state,
      () => applyOperation(accumulator, currentValue, pendingOp),
      (result) => ({
        ...state,
        display: formatNumber(result),
        accumulator: result,
        pendingOp: op,
        waitingForOperand: true,
      }),
    );
  }

  return {
    ...state,
    accumulator:
      state.accumulator !== null && state.waitingForOperand ? state.accumulator : currentValue,
    pendingOp: op,
    waitingForOperand: true,
  };
}

export function pressEquals(state: CalculatorState): CalculatorState {
  if (state.errorState) {
    return state;
  }

  if (state.accumulator === null || state.pendingOp === null) {
    return state;
  }

  const currentValue = Number(state.display);
  if (!Number.isFinite(currentValue)) {
    return enterErrorState(state, INVALID_EXPRESSION_MESSAGE);
  }

  const pendingOp = state.pendingOp;
  const accumulator = state.accumulator;
  return evaluateTransition(
    state,
    () => applyOperation(accumulator, currentValue, pendingOp),
    (result) => ({
      ...state,
      display: formatNumber(result),
      accumulator: null,
      pendingOp: null,
      waitingForOperand: true,
    }),
  );
}

export function pressClearEntry(state: CalculatorState): CalculatorState {
  if (state.errorState) {
    return state;
  }

  return {
    ...state,
    display: '0',
    expressionInput: '',
    naturalLanguageInput: '',
    waitingForOperand: state.pendingOp !== null,
  };
}

export function pressAllClear(): CalculatorState {
  return createInitialState();
}

export function setExpressionInput(
  state: CalculatorState,
  expressionInput: string,
): CalculatorState {
  if (state.errorState) {
    return state;
  }

  return {
    ...state,
    expressionInput,
  };
}

export function submitExpression(state: CalculatorState): CalculatorState {
  if (state.errorState) {
    return state;
  }

  return evaluateTransition(
    state,
    () => evaluateExpression(state.expressionInput),
    (result) => ({
      ...state,
      display: formatNumber(result),
      accumulator: null,
      pendingOp: null,
      errorState: false,
      waitingForOperand: true,
    }),
  );
}

export function setNaturalLanguageInput(
  state: CalculatorState,
  naturalLanguageInput: string,
): CalculatorState {
  if (state.errorState) {
    return state;
  }

  return {
    ...state,
    naturalLanguageInput,
  };
}

export function applyTranslation(
  state: CalculatorState,
  outcome: TranslationOutcome,
): CalculatorState {
  if (state.errorState) {
    return state;
  }

  if (outcome.status === 'failed') {
    return enterErrorState({ ...state, expressionInput: '' }, TRANSLATION_FAILED_MESSAGE);
  }

  return submitExpression({ ...state, expressionInput: outcome.expression });
}
