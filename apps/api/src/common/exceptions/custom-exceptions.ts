import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom Exception Classes for Dynamic Resolution API
 *
 * Provides specific error types with proper HTTP status codes and error messages
 */

/**
 * Invalid Interval Exception (HTTP 400)
 *
 * Thrown when interval parameter is not one of: 15m, 1m, 10s, 1s
 */
export class InvalidIntervalException extends HttpException {
  constructor(interval: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Invalid interval: ${interval}. Allowed values: 15m, 1m, 10s, 1s`,
        error: 'INVALID_INTERVAL',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Invalid Time Range Exception (HTTP 400)
 *
 * Thrown when endTime is before or equal to startTime
 */
export class InvalidTimeRangeException extends HttpException {
  constructor(startTime?: string, endTime?: string) {
    const message = startTime && endTime
      ? `Invalid time range: endTime (${endTime}) must be after startTime (${startTime})`
      : 'End time must be after start time';

    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'INVALID_TIME_RANGE',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Facility Not Found Exception (HTTP 404)
 *
 * Thrown when facility ID does not exist in database
 */
export class FacilityNotFoundException extends HttpException {
  constructor(facilityId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `Facility not found: ${facilityId}`,
        error: 'FACILITY_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Database Query Exception (HTTP 500)
 *
 * Thrown when database query execution fails
 */
export class DatabaseQueryException extends HttpException {
  constructor(originalError?: Error) {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database query failed',
        error: 'DATABASE_ERROR',
        details: originalError?.message,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
