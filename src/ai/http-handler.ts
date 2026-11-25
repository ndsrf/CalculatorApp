import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TranslateService } from './translate-service.ts';

const MAX_BODY_BYTES = 4096;

type NextFunction = (error?: unknown) => void;

class BadRequestError extends Error {}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new BadRequestError('Request body too large');
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    throw new BadRequestError('Request body must be JSON');
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export function createTranslateMiddleware(service: Pick<TranslateService, 'translate'>) {
  return async (req: IncomingMessage, res: ServerResponse, next: NextFunction): Promise<void> => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    if (!req.headers['content-type']?.startsWith('application/json')) {
      sendJson(res, 415, { status: 'unavailable' });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const question = (body as { question?: unknown } | null)?.question;
      if (typeof question !== 'string') {
        sendJson(res, 400, { status: 'refused' });
        return;
      }

      const result = await service.translate(question);
      sendJson(
        res,
        200,
        result.status === 'translated'
          ? { status: 'translated', expression: result.expression }
          : { status: result.status },
      );
    } catch (error) {
      sendJson(res, error instanceof BadRequestError ? 400 : 500, { status: 'unavailable' });
    }
  };
}
