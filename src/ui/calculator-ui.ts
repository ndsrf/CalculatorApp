import {
  type CalculatorState,
  createInitialState,
  type Digit,
  type Operator,
  pressAllClear,
  pressClearEntry,
  pressDigit,
  pressEquals,
  pressOperator,
  setExpressionInput,
  submitExpression,
} from '../core/calculator.ts';

const TEMPLATE = `
<section class="calculator" aria-label="Calculator">
  <header class="calculator__header">
    <h1 class="calculator__title">Calculator</h1>
    <p class="calculator__subtitle">Standard Keypad + Expression Input</p>
  </header>

  <output id="display-current" aria-live="polite">0</output>

  <div class="expression-row">
    <input
      id="expression-input"
      type="text"
      placeholder="e.g. (12 + 8) / 4"
      aria-label="Expression Input"
      autocomplete="off"
    />
    <button type="button" data-action="submit-expression">Run</button>
  </div>

  <div class="keypad" role="group" aria-label="Standard Keypad">
    <button type="button" data-action="ac" class="span-2">AC</button>
    <button type="button" data-action="ce">CE</button>
    <button type="button" data-op="divide">÷</button>

    <button type="button" data-key="7">7</button>
    <button type="button" data-key="8">8</button>
    <button type="button" data-key="9">9</button>
    <button type="button" data-op="multiply">×</button>

    <button type="button" data-key="4">4</button>
    <button type="button" data-key="5">5</button>
    <button type="button" data-key="6">6</button>
    <button type="button" data-op="subtract">−</button>

    <button type="button" data-key="1">1</button>
    <button type="button" data-key="2">2</button>
    <button type="button" data-key="3">3</button>
    <button type="button" data-op="add">+</button>

    <button type="button" data-key="0" class="span-2">0</button>
    <button type="button" data-action="equals" class="span-2">=</button>
  </div>
</section>
`;

export function mountCalculator(root: HTMLElement): void {
  root.innerHTML = TEMPLATE;

  const displayEl = root.querySelector<HTMLElement>('#display-current');
  const expressionInputEl = root.querySelector<HTMLInputElement>('#expression-input');
  const submitExpressionBtn = root.querySelector<HTMLButtonElement>('[data-action="submit-expression"]');
  const operatorButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-op]'));

  if (!displayEl || !expressionInputEl || !submitExpressionBtn) {
    throw new Error('Calculator template is missing required canonical selectors');
  }

  let state: CalculatorState = createInitialState();

  function render(): void {
    displayEl!.textContent = state.display;
    displayEl!.classList.toggle('is-error', state.errorState);

    if (expressionInputEl!.value !== state.expressionInput) {
      expressionInputEl!.value = state.expressionInput;
    }

    expressionInputEl!.disabled = state.errorState;
    submitExpressionBtn!.disabled = state.errorState;
    for (const btn of operatorButtons) {
      btn.disabled = state.errorState;
    }
  }

  function handleSubmitExpression(): void {
    state = setExpressionInput(state, expressionInputEl!.value);
    state = submitExpression(state);
    render();
  }

  root.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const digit = button.dataset.key as Digit | undefined;
      if (digit) {
        state = pressDigit(state, digit);
        render();
      }
    });
  });

  operatorButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const op = button.dataset.op as Operator | undefined;
      if (op) {
        state = pressOperator(state, op);
        render();
      }
    });
  });

  root.querySelector<HTMLButtonElement>('[data-action="equals"]')?.addEventListener('click', () => {
    state = pressEquals(state);
    render();
  });

  root.querySelector<HTMLButtonElement>('[data-action="ce"]')?.addEventListener('click', () => {
    state = pressClearEntry(state);
    render();
  });

  root.querySelector<HTMLButtonElement>('[data-action="ac"]')?.addEventListener('click', () => {
    state = pressAllClear();
    render();
  });

  expressionInputEl.addEventListener('input', () => {
    state = setExpressionInput(state, expressionInputEl.value);
  });

  expressionInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmitExpression();
    }
  });

  submitExpressionBtn.addEventListener('click', handleSubmitExpression);

  render();
}
