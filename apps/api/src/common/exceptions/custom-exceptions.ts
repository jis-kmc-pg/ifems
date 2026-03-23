// ============================================================
// 커스텀 예외 클래스 — custom-exceptions.ts
// ============================================================
//
// [목적]
//   NestJS의 기본 예외(BadRequestException, NotFoundException 등) 대신
//   도메인 특화 예외 클래스를 사용하여:
//   1) 에러 메시지 일관성 보장 (동일 상황 = 동일 메시지)
//   2) 에러 코드(error 필드) 제공 → 클라이언트에서 에러 타입 구분 가능
//   3) throw 지점에서 메시지를 매번 작성할 필요 없음
//
// [응답 형식]
//   모든 커스텀 예외는 아래 JSON 형식으로 응답:
//   {
//     "statusCode": 400 | 404 | 500,
//     "message": "사람이 읽을 수 있는 에러 메시지",
//     "error": "UPPER_SNAKE_CASE 에러 코드"
//   }
//
// [적용 서비스]
//   monitoring.service.ts : InvalidIntervalException, InvalidTimeRangeException,
//                           InvalidDateFormatException, FacilityNotFoundException,
//                           EntityNotFoundException, DatabaseQueryException
//
// [예외 목록]
//   HTTP 400 (Bad Request):
//     - InvalidIntervalException    : interval 파라미터가 유효하지 않을 때
//     - InvalidTimeRangeException   : endTime <= startTime일 때
//     - InvalidDateFormatException  : 날짜 형식이 ISO8601이 아닐 때
//   HTTP 404 (Not Found):
//     - FacilityNotFoundException   : 설비 코드로 조회 실패
//     - EntityNotFoundException     : 범용 엔터티 미발견 (Line, Factory 등)
//   HTTP 500 (Internal Server Error):
//     - DatabaseQueryException      : DB 쿼리 실행 실패
// ============================================================

import { HttpException, HttpStatus } from '@nestjs/common';

// ──────────────────────────────────────────────
// HTTP 400 — Bad Request 계열
// ──────────────────────────────────────────────

/**
 * 유효하지 않은 interval 예외 (HTTP 400)
 *
 * 동적 해상도 API에서 interval 파라미터가
 * 허용된 값(15m, 1m, 10s, 1s)이 아닐 때 발생.
 *
 * @example
 * ```ts
 * if (!INTERVAL_TO_BUCKET[interval]) {
 *   throw new InvalidIntervalException(interval);
 * }
 * // → { statusCode: 400, message: "Invalid interval: 5m. Allowed: 15m, 1m, 10s, 1s", error: "INVALID_INTERVAL" }
 * ```
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
 * 유효하지 않은 시간 범위 예외 (HTTP 400)
 *
 * endTime이 startTime보다 이전이거나 동일할 때 발생.
 * startTime/endTime을 전달하면 구체적 에러 메시지 생성.
 *
 * @param startTime - 시작 시간 문자열 (선택)
 * @param endTime   - 종료 시간 문자열 (선택)
 *
 * @example
 * ```ts
 * if (start >= end) {
 *   throw new InvalidTimeRangeException(startTime, endTime);
 * }
 * // → { message: "Invalid time range: endTime (2026-03-10) must be after startTime (2026-03-12)" }
 * ```
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
 * 유효하지 않은 날짜 형식 예외 (HTTP 400)
 *
 * API에 전달된 날짜 문자열이 ISO8601 형식이 아니거나
 * new Date()로 파싱할 수 없을 때 발생.
 *
 * [기존 패턴 (반복)]
 *   throw new BadRequestException('Invalid date format. Use ISO8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).');
 *   → monitoring.service.ts에서 3회 반복
 *
 * [개선]
 *   throw new InvalidDateFormatException();
 *   → 메시지 일관성 + 에러 코드 제공
 *
 * @example
 * ```ts
 * if (isNaN(start.getTime()) || isNaN(end.getTime())) {
 *   throw new InvalidDateFormatException();
 * }
 * // → { statusCode: 400, message: "Invalid date format...", error: "INVALID_DATE_FORMAT" }
 * ```
 */
export class InvalidDateFormatException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid date format. Use ISO8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).',
        error: 'INVALID_DATE_FORMAT',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

// ──────────────────────────────────────────────
// HTTP 404 — Not Found 계열
// ──────────────────────────────────────────────

/**
 * 설비 미발견 예외 (HTTP 404)
 *
 * 설비 코드(facility code)로 DB 조회 시 결과가 없을 때 발생.
 * FacilityNotFoundException은 설비 전용이며,
 * Line/Factory 등 다른 엔터티는 EntityNotFoundException을 사용.
 *
 * @param facilityId - 조회에 실패한 설비 코드 (예: 'HNK10-000')
 *
 * @example
 * ```ts
 * const facility = await prisma.facility.findUnique({ where: { code: facilityId } });
 * if (!facility) throw new FacilityNotFoundException(facilityId);
 * // → { statusCode: 404, message: "Facility not found: HNK10-000", error: "FACILITY_NOT_FOUND" }
 * ```
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
 * 범용 엔터티 미발견 예외 (HTTP 404)
 *
 * Line, Factory, Tag 등 설비 외의 엔터티가 DB에서 발견되지 않을 때 사용.
 * entity 이름에 따라 에러 코드가 동적으로 생성됨.
 *
 * [FacilityNotFoundException과의 차이]
 *   - FacilityNotFoundException: 설비 전용 (에러 코드 고정: FACILITY_NOT_FOUND)
 *   - EntityNotFoundException: 범용 (에러 코드 동적: LINE_NOT_FOUND, FACTORY_NOT_FOUND 등)
 *
 * @param entity     - 엔터티 유형 이름 (예: 'Line', 'Factory', 'Tag')
 * @param identifier - 조회에 실패한 식별자 (예: 'HNK10', 'HW4')
 *
 * @example
 * ```ts
 * const line = await prisma.line.findUnique({ where: { code: lineCode } });
 * if (!line) throw new EntityNotFoundException('Line', lineCode);
 * // → { statusCode: 404, message: "Line not found: HNK10", error: "LINE_NOT_FOUND" }
 *
 * const factory = await prisma.factory.findUnique({ where: { code: factoryCode } });
 * if (!factory) throw new EntityNotFoundException('Factory', factoryCode);
 * // → { statusCode: 404, message: "Factory not found: HW4", error: "FACTORY_NOT_FOUND" }
 * ```
 */
export class EntityNotFoundException extends HttpException {
  constructor(entity: string, identifier: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `${entity} not found: ${identifier}`,
        error: `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

// ──────────────────────────────────────────────
// HTTP 500 — Internal Server Error 계열
// ──────────────────────────────────────────────

/**
 * 데이터베이스 쿼리 실행 실패 예외 (HTTP 500)
 *
 * Prisma $queryRaw 등의 DB 쿼리가 런타임에 실패했을 때 사용.
 * 원본 에러의 메시지를 details 필드에 포함하여 디버깅을 지원.
 *
 * [보안 고려]
 *   details 필드에 SQL 쿼리 내용이 포함될 수 있으므로
 *   프로덕션에서는 GlobalExceptionFilter에서 details를 제거하거나
 *   로그에만 기록하는 것이 권장됨.
 *
 * @param originalError - 원본 Error 객체 (Prisma 에러 등)
 *
 * @example
 * ```ts
 * try {
 *   return await this.prisma.$queryRaw`SELECT ...`;
 * } catch (error) {
 *   throw new DatabaseQueryException(error as Error);
 * }
 * // → { statusCode: 500, message: "Database query failed", error: "DATABASE_ERROR", details: "..." }
 * ```
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
