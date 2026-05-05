export interface CaughtError {
  statusCode?: number;
  message?: string;
  name?: string;
}

export const asCaught = (e: unknown): CaughtError => e as CaughtError;
