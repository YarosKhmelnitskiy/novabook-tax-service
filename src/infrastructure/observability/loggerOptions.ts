import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Params } from 'nestjs-pino';
import { stdTimeFunctions } from 'pino';
import { IAppConfig } from '../../config/config';

const REQUEST_ID_HEADER = 'x-request-id';
const MAX_REQUEST_ID_LENGTH = 128;

export function createLoggerOptions(config: IAppConfig): Params {
  return {
    pinoHttp: {
      level: config.logLevel,
      timestamp: stdTimeFunctions.isoTime,
      formatters: { level: (label: string) => ({ level: label }) },
      autoLogging: false,
      quietReqLogger: true,
      customAttributeKeys: { reqId: 'requestId' },
      genReqId: resolveRequestId,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  };
}

export function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
  const header = req.headers[REQUEST_ID_HEADER];
  const candidate = typeof header === 'string' ? header.trim() : '';
  const requestId = candidate.length > 0 && candidate.length <= MAX_REQUEST_ID_LENGTH ? candidate : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}
