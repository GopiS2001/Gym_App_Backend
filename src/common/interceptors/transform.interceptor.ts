import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Decimal } from '@prisma/client/runtime/library';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
}

/**
 * Converts Prisma Decimal instances into plain numbers and Date objects into
 * ISO strings so the mobile client never has to deal with driver-specific
 * value wrappers.
 */
function normalise(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Decimal) return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object') {
    // Prisma Decimal may arrive as a structurally-similar object
    if (typeof value.toNumber === 'function' && value.constructor?.name === 'Decimal') {
      return value.toNumber();
    }
    if (Buffer.isBuffer(value)) return value;
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      out[key] = normalise(value[key]);
    }
    return out;
  }
  return value;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      map((payload: any) => {
        const message =
          payload && typeof payload === 'object' && '__message' in payload
            ? payload.__message
            : defaultMessage(request.method);

        let data = payload;
        if (payload && typeof payload === 'object' && '__message' in payload) {
          const { __message, ...rest } = payload;
          data = 'data' in rest ? rest.data : rest;
        }

        return {
          success: true,
          data: normalise(data) ?? null,
          message,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

function defaultMessage(method: string): string {
  switch (method) {
    case 'POST':
      return 'Record created successfully';
    case 'PUT':
    case 'PATCH':
      return 'Record updated successfully';
    case 'DELETE':
      return 'Record deleted successfully';
    default:
      return 'Record retrieved successfully';
  }
}
