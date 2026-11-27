import {
  applyTranslation,
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
  setNaturalLanguageInput,
  submitExpression,
  type TranslationOutcome,
} from '../core/index.ts';

const TEMPLATE = `
<section class="calculator" aria-label="Calculator">
  <header class="calculator__header">
    <h1 class="calculator__title">Calculator</h1>
    <p class="calculator__subtitle">Keypad · Expression · Natural Language</p>
  </header>

  <output id="display-current" aria-live="polite">0</output>

  <div class="input-row">
    <input
      id="natural-language-input"
      type="text"
      placeholder="Ask: 15% of 80, plus 5"
      aria-label="Natural Language Input"
      autocomplete="off"
      maxlength="200"
    />
    <button type="button" data-action="translate-question" aria-busy="false">Translate Question</button>
  </div>

  <div class="input-row">
    <input
      id="expression-input"
      type="text"
      placeholder="e.g. (12 + 8) / 4"
      aria-label="Expression Input"
      autocomplete="off"
    />
    <button type="button" data-action="submit-expression">Submit Expression</button>
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

export interface CalculatorDependencies {
  translate: (question: string) => Promise<TranslationOutcome>;
}

export function mountCalculator(root: HTMLElement, deps: CalculatorDependencies): void {
  root.innerHTML = TEMPLATE;

  const displayEl = root.querySelector<HTMLElement>('#display-current');
  const expressionInputEl = root.querySelector<HTMLInputElement>('#expression-input');
  const submitExpressionBtn = root.querySelector<HTMLButtonElement>(
    '[data-action="submit-expression"]',
  );
  const naturalLanguageInputEl = root.querySelector<HTMLInputElement>('#natural-language-input');
  const translateQuestionBtn = root.querySelector<HTMLButtonElement>(
    '[data-action="translate-question"]',
  );
  const operatorButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-op]'));

  if (
    !displayEl ||
    !expressionInputEl ||
    !submitExpressionBtn ||
    !naturalLanguageInputEl ||
    !translateQuestionBtn
  ) {
    throw new Error('Calculator template is missing required canonical selectors');
  }

  let state: CalculatorState = createInitialState();
  let translationsStarted = 0;
  let pendingTranslation: number | null = null;

  function render(): void {
    displayEl!.textContent = state.display;
    displayEl!.classList.toggle('is-error', state.errorState);

    if (expressionInputEl!.value !== state.expressionInput) {
      expressionInputEl!.value = state.expressionInput;
    }

    if (naturalLanguageInputEl!.value !== state.naturalLanguageInput) {
      naturalLanguageInputEl!.value = state.naturalLanguageInput;
    }

    const busy = pendingTranslation !== null;
    expressionInputEl!.disabled = state.errorState;
    submitExpressionBtn!.disabled = state.errorState;
    naturalLanguageInputEl!.disabled = state.errorState;
    translateQuestionBtn!.disabled = state.errorState || busy;
    translateQuestionBtn!.setAttribute('aria-busy', String(busy));
    for (const btn of operatorButtons) {
      btn.disabled = state.errorState;
    }
  }

  function handleSubmitExpression(): void {
    state = setExpressionInput(state, expressionInputEl!.value);
    state = submitExpression(state);
    render();
  }

  async function handleTranslateQuestion(): Promise<void> {
    if (pendingTranslation !== null || state.errorState) {
      return;
    }

    state = setNaturalLanguageInput(state, naturalLanguageInputEl!.value);
    translationsStarted += 1;
    const requestId = translationsStarted;
    pendingTranslation = requestId;
    render();

    const outcome = await deps.translate(state.naturalLanguageInput);
    if (pendingTranslation !== requestId) {
      return;
    }

    pendingTranslation = null;
    state = applyTranslation(state, outcome);
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
    pendingTranslation = null;
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

  naturalLanguageInputEl.addEventListener('input', () => {
    state = setNaturalLanguageInput(state, naturalLanguageInputEl.value);
  });

  naturalLanguageInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleTranslateQuestion();
    }
  });

  translateQuestionBtn.addEventListener('click', () => {
    void handleTranslateQuestion();
  });

  render();
}
