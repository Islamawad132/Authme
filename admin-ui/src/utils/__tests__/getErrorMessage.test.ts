import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../getErrorMessage';

describe('getErrorMessage', () => {
  it('returns the fallback when error is null', () => {
    expect(getErrorMessage(null)).toBe('An error occurred');
  });

  it('returns a custom fallback when error is null', () => {
    expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });

  it('returns the string message from an axios-like error response', () => {
    const axiosError = {
      response: {
        data: { message: 'Validation failed' },
      },
    };
    expect(getErrorMessage(axiosError)).toBe('Validation failed');
  });

  it('returns the first item when message is an array', () => {
    const axiosError = {
      response: {
        data: { message: ['username must not be empty', 'email is invalid'] },
      },
    };
    expect(getErrorMessage(axiosError)).toBe('username must not be empty');
  });

  it('returns fallback when message array is empty', () => {
    const axiosError = {
      response: { data: { message: [] } },
    };
    expect(getErrorMessage(axiosError, 'fallback')).toBe('fallback');
  });

  it('returns Error.message for a plain Error', () => {
    expect(getErrorMessage(new Error('Something went wrong'))).toBe('Something went wrong');
  });

  it('returns fallback when error is an unknown object with no response', () => {
    expect(getErrorMessage({ foo: 'bar' }, 'fallback')).toBe('fallback');
  });

  it('returns fallback for a plain string (non-Error, non-axios)', () => {
    expect(getErrorMessage('raw string', 'fallback')).toBe('fallback');
  });
});
