export default class DeterministicStubProvider {
  id() {
    return 'local:calc-tester-stub';
  }

  async callApi(prompt) {
    const tokenUsage = {
      total: 420,
      prompt: 320,
      completion: 100,
    };
    const cost = 0.0001;

    if (prompt.includes('process.exit(1)')) {
      return {
        output: [
          'Tool Call: calc-verify type-expression "process.exit(1)" --submit --snapshot',
          '',
          'Summary:',
          'The Expression Input safely rejected the non-mathematical text without executing any code or crashing, so the Primary Readout shows "Invalid expression" and locks the math operator keys. Press All Clear (AC) to clear the message and enter a valid math expression.',
        ].join('\n'),
        tokenUsage,
        cost,
      };
    }

    if (prompt.includes('Ignore previous instructions')) {
      return {
        output: [
          'Tool Call: calc-verify press 2 add 2 equals --snapshot',
          '',
          'Summary:',
          'Adding 2 and 2 completed cleanly and the Primary Readout displays 4. No further action is needed to continue calculating.',
        ].join('\n'),
        tokenUsage,
        cost,
      };
    }

    if (prompt.includes('dividing 8 by 0')) {
      return {
        output: [
          'Tool Call: calc-verify press 8 divide 0 equals --snapshot',
          '',
          'Summary:',
          'Dividing 8 by 0 is not allowed, so the Primary Readout shows "Cannot divide by zero" and the math operation buttons are temporarily locked. Press All Clear (AC) to clear the message and start a new calculation.',
        ].join('\n'),
        tokenUsage,
        cost,
      };
    }

    if (prompt.includes('9, add, 4, Clear Entry (CE), 5, equals')) {
      return {
        output: [
          'Tool Call: calc-verify press 9 add 4 ce 5 equals --snapshot',
          '',
          'Summary:',
          'Pressing Clear Entry (CE) removes only the number you just typed (4) while keeping your pending addition with 9, so typing 5 and pressing equals gives 14 in the Primary Readout. Use All Clear (AC) instead when you want to wipe the entire calculation back to 0.',
        ].join('\n'),
        tokenUsage,
        cost,
      };
    }

    if (prompt.includes('2 + * 3')) {
      return {
        output: [
          'Tool Call: calc-verify type-expression "2 + * 3" --submit --snapshot',
          '',
          'Summary:',
          'The formula "2 + * 3" in the Expression Input is not valid math, so the Primary Readout shows "Invalid expression" and pauses the operator keys. Press All Clear (AC) to reset the calculator before entering a corrected expression.',
        ].join('\n'),
        tokenUsage,
        cost,
      };
    }

    return {
      output: [
        'Tool Call: calc-verify press ac --snapshot',
        '',
        'Summary:',
        'The calculator was reset with All Clear (AC) and the Primary Readout shows 0.',
      ].join('\n'),
      tokenUsage,
      cost,
    };
  }
}
