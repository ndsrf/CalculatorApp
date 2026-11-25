import './ui/styles.css';
import { mountCalculator } from './ui/calculator-ui.ts';
import { requestTranslation } from './ui/translator-client.ts';

const appRoot = document.querySelector<HTMLElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app mount point');
}

mountCalculator(appRoot, { translate: requestTranslation });
