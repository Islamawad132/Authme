import type { AxiosError } from 'axios';

export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<{ message?: string | string[] }>;
    const msg = axiosError.response?.data?.message;
    if (Array.isArray(msg)) return msg[0] || fallback;
    if (typeof msg === 'string') return msg;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
