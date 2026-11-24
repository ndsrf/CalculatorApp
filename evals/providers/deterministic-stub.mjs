const TOKEN_USAGE = {
  total: 420,
  prompt: 320,
  completion: 100,
};
const STUB_COST = 0.0001;

const CALC_TESTER_FIXTURES = [
  {
    match: 'process.exit(1)',
    toolCall: 'calc-verify type-expression "process.exit(1)" --submit --snapshot',
    summary:
      'The Expression Input safely rejected the non-mathematical text without executing any code or crashing, so the Primary Readout shows "Invalid expression" and locks the math operator keys. Press All Clear (AC) to clear the message and enter a valid math expression.',
  },
  {
    match: 'Ignore previous instructions',
    toolCall: 'calc-verify press 2 add 2 equals --snapshot',
    summary:
      'Adding 2 and 2 completed cleanly and the Primary Readout displays 4. No further action is needed to continue calculating.',
  },
  {
    match: 'dividing 8 by 0',
    toolCall: 'calc-verify press 8 divide 0 equals --snapshot',
    summary:
      'Dividing 8 by 0 is not allowed, so the Primary Readout shows "Cannot divide by zero" and the math operation buttons are temporarily locked. Press All Clear (AC) to clear the message and start a new calculation.',
  },
  {
    match: '9, add, 4, Clear Entry (CE), 5, equals',
    toolCall: 'calc-verify press 9 add 4 ce 5 equals --snapshot',
    summary:
      'Pressing Clear Entry (CE) removes only the number you just typed (4) while keeping your pending addition with 9, so typing 5 and pressing equals gives 14 in the Primary Readout. Use All Clear (AC) instead when you want to wipe the entire calculation back to 0.',
  },
  {
    match: '2 + * 3',
    toolCall: 'calc-verify type-expression "2 + * 3" --submit --snapshot',
    summary:
      'The formula "2 + * 3" in the Expression Input is not valid math, so the Primary Readout shows "Invalid expression" and pauses the operator keys. Press All Clear (AC) to reset the calculator before entering a corrected expression.',
  },
];

const DEFAULT_FIXTURE = {
  toolCall: 'calc-verify press ac --snapshot',
  summary: 'The calculator was reset with All Clear (AC) and the Primary Readout shows 0.',
};

const DOC_COMPILATION_GUIDE = [
  '# Calculator App Help Guide',
  '',
  '## Quick Start for Everyday Calculations',
  '',
  'Use the Standard Keypad to enter digits 0-9 and perform step-by-step arithmetic (addition, subtraction, multiplication, and division), viewing each update in the Primary Readout.',
  '- Press Clear Entry (CE) to clear only the current number while preserving your pending calculation.',
  '- Press All Clear (AC) to reset the entire calculation and return the Primary Readout to 0.',
  '- If you divide by zero, the Primary Readout displays "Cannot divide by zero" and pauses operator keys until you press All Clear (AC).',
  '',
  '## Typing Full Formulas',
  '',
  'Type complete parenthesized formulas such as (10 + 5) * 2 - 4 / 2 into the Expression Input and activate Submit Expression to see the evaluated result in the Primary Readout.',
  '- Clear Entry (CE) clears the active Expression Input without erasing an unrelated pending calculation.',
  '- If a formula has invalid syntax or divides by zero, the Primary Readout shows "Invalid expression" or "Cannot divide by zero" and disables operator keys until you press All Clear (AC).',
].join('\n');

function buildResponse(toolCall, summary) {
  return {
    output: [`Tool Call: ${toolCall}`, '', 'Summary:', summary].join('\n'),
    tokenUsage: TOKEN_USAGE,
    cost: STUB_COST,
  };
}

export default class DeterministicStubProvider {
  constructor(options = {}) {
    this.label = options.label;
  }

  id() {
    return this.label ? `local:${this.label}` : 'local:calc-tester-stub';
  }

  async callApi(prompt) {
    if (prompt.includes('End-User Help Documentation Generator')) {
      return {
        output: DOC_COMPILATION_GUIDE,
        tokenUsage: TOKEN_USAGE,
        cost: STUB_COST,
      };
    }

    const fixture =
      CALC_TESTER_FIXTURES.find((entry) => prompt.includes(entry.match)) ?? DEFAULT_FIXTURE;
    return buildResponse(fixture.toolCall, fixture.summary);
  }
}
