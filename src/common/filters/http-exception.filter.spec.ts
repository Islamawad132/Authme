import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter.js';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
  });

  it('should handle HttpException with string message', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        timestamp: expect.any(String),
      }),
    );
  });

  it('should handle HttpException with object response', () => {
    const exception = new BadRequestException({
      message: ['field is required'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const jsonArg = mockResponse.json.mock.calls[0][0];
    expect(jsonArg.statusCode).toBe(400);
    expect(jsonArg.timestamp).toBeDefined();
  });

  it('should handle non-HttpException as 500', () => {
    const exception = new Error('Something broke');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('should handle non-Error exceptions as 500', () => {
    filter.catch('string-error', mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('should include ISO timestamp in response', () => {
    const exception = new HttpException('Test', 400);

    filter.catch(exception, mockHost);

    const jsonArg = mockResponse.json.mock.calls[0][0];
    // Verify it's a valid ISO string
    expect(new Date(jsonArg.timestamp).toISOString()).toBe(jsonArg.timestamp);
  });
});
