export const DIVISION_BY_ZERO_MESSAGE = 'Cannot divide by zero';
export const INVALID_EXPRESSION_MESSAGE = 'Invalid expression';

export class DivisionByZeroError extends Error {
  constructor() {
    super(DIVISION_BY_ZERO_MESSAGE);
    this.name = 'DivisionByZeroError';
  }
}

export class ExpressionSyntaxError extends Error {
  constructor(detail?: string) {
    super(detail ? `${INVALID_EXPRESSION_MESSAGE}: ${detail}` : INVALID_EXPRESSION_MESSAGE);
    this.name = 'ExpressionSyntaxError';
  }
}

type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

function assertFinite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new ExpressionSyntaxError('non-finite result');
  }
  return value;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') {
          dotCount += 1;
          if (dotCount > 1) {
            throw new ExpressionSyntaxError('multiple decimal points');
          }
        }
        numStr += input[i];
        i += 1;
      }
      if (numStr === '.') {
        throw new ExpressionSyntaxError('lone decimal point');
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    switch (ch) {
      case '+':
        tokens.push({ type: 'PLUS', value: ch });
        break;
      case '-':
        tokens.push({ type: 'MINUS', value: ch });
        break;
      case '*':
        tokens.push({ type: 'STAR', value: ch });
        break;
      case '/':
        tokens.push({ type: 'SLASH', value: ch });
        break;
      case '(':
        tokens.push({ type: 'LPAREN', value: ch });
        break;
      case ')':
        tokens.push({ type: 'RPAREN', value: ch });
        break;
      default:
        throw new ExpressionSyntaxError(`unexpected character '${ch}'`);
    }
    i += 1;
  }

  return tokens;
}

class RecursiveDescentParser {
  private readonly tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new ExpressionSyntaxError('empty expression');
    }
    const result = assertFinite(this.parseAdditive());
    if (this.pos < this.tokens.length) {
      throw new ExpressionSyntaxError(`unexpected token '${this.tokens[this.pos].value}'`);
    }
    return Object.is(result, -0) ? 0 : result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const token = this.tokens[this.pos];
    this.pos += 1;
    return token;
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();

    while (this.peek()?.type === 'PLUS' || this.peek()?.type === 'MINUS') {
      const op = this.consume();
      const right = this.parseMultiplicative();
      left = assertFinite(op.type === 'PLUS' ? left + right : left - right);
    }

    return left;
  }

  private parseMultiplicative(): number {
    let left = this.parseUnary();

    while (this.peek()?.type === 'STAR' || this.peek()?.type === 'SLASH') {
      const op = this.consume();
      const right = this.parseUnary();
      if (op.type === 'STAR') {
        left = assertFinite(left * right);
      } else {
        if (right === 0) {
          throw new DivisionByZeroError();
        }
        left = assertFinite(left / right);
      }
    }

    return left;
  }

  private parseUnary(): number {
    const token = this.peek();
    if (token?.type === 'PLUS') {
      this.consume();
      return this.parseUnary();
    }
    if (token?.type === 'MINUS') {
      this.consume();
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) {
      throw new ExpressionSyntaxError('unexpected end of input');
    }

    if (token.type === 'NUMBER') {
      this.consume();
      return assertFinite(Number(token.value));
    }

    if (token.type === 'LPAREN') {
      this.consume();
      const inner = this.parseAdditive();
      const closing = this.peek();
      if (!closing || closing.type !== 'RPAREN') {
        throw new ExpressionSyntaxError('missing closing parenthesis');
      }
      this.consume();
      return inner;
    }

    throw new ExpressionSyntaxError(`unexpected token '${token.value}'`);
  }
}

export type ExpressionCheck = { ok: true } | { ok: false; reason: string };

export function checkExpressionSyntax(expression: string): ExpressionCheck {
  try {
    evaluateExpression(expression);
    return { ok: true };
  } catch (error) {
    if (error instanceof DivisionByZeroError) {
      return { ok: true };
    }
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression);
  return new RecursiveDescentParser(tokens).parse();
}
