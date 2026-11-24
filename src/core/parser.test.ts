import { describe, expect, it } from 'vitest';
import { DivisionByZeroError, evaluateExpression, ExpressionSyntaxError } from './parser.ts';

describe('evaluateExpression', () => {
  it('evaluates basic arithmetic with operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
    expect(evaluateExpression('(10 + 5) * 2 - 4 / 2')).toBe(28);
  });

  it('handles unary operators and decimals', () => {
    expect(evaluateExpression('-6 + (3 * 4)')).toBe(6);
    expect(evaluateExpression('+(2.5 + 1.5) * -2')).toBe(-8);
    expect(evaluateExpression('-0')).toBe(0);
  });

  it('throws DivisionByZeroError on direct and computed zero divisors', () => {
    expect(() => evaluateExpression('8 / 0')).toThrow(DivisionByZeroError);
    expect(() => evaluateExpression('10 / (5 - 5)')).toThrow(DivisionByZeroError);
  });

  it('rejects intermediate Infinity overflow instead of returning 0', () => {
    const huge = '9'.repeat(308);
    expect(() => evaluateExpression(`1 / (${huge} * 10)`)).toThrow(ExpressionSyntaxError);
  });

  it('rejects malformed expressions and unsafe characters without eval()', () => {
    expect(() => evaluateExpression('')).toThrow(ExpressionSyntaxError);
    expect(() => evaluateExpression('   ')).toThrow(ExpressionSyntaxError);
    expect(() => evaluateExpression('2 + * 3')).toThrow(ExpressionSyntaxError);
    expect(() => evaluateExpression('(4 + 5')).toThrow(ExpressionSyntaxError);
    expect(() => evaluateExpression('process.exit(1)')).toThrow(ExpressionSyntaxError);
    expect(() => evaluateExpression('1..2 + 3')).toThrow(ExpressionSyntaxError);
  });
});
