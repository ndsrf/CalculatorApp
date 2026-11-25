import type { TranslationOutcome } from '../core/index.ts';

export async function requestTranslation(question: string): Promise<TranslationOutcome> {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) {
      return { status: 'failed' };
    }

    const body = (await response.json()) as { status?: unknown; expression?: unknown };
    return body.status === 'translated' && typeof body.expression === 'string'
      ? { status: 'translated', expression: body.expression }
      : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
