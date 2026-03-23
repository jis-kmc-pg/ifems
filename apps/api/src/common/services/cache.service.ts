// ============================================================
// CacheService — 범용 인메모리 캐시 서비스
// ============================================================
//
// [목적]
//   monitoring.service.ts에 내장되어 있던 rangeCache 로직을
//   NestJS Injectable 서비스로 추출하여 공통화.
//   MonitoringService 외에도 DashboardService, AnalysisService 등
//   다른 서비스에서도 동일한 캐시 패턴을 재사용할 수 있다.
//
// [캐시 동작 방식]
//   - Map<string, CacheEntry> 기반 키-값 저장소
//   - 각 엔트리에 개별 TTL(Time-To-Live) 설정 가능
//   - get() 호출 시 만료 여부를 체크하여 자동 삭제 (lazy expiration)
//   - 5분마다 cleanup() 실행하여 만료 엔트리 일괄 제거 (scheduled expiration)
//
// [기존 코드 → 현재 코드 매핑]
//   this.rangeCache.get(key)         → this.cache.get<T>(key)
//   this.rangeCache.set(key, entry)  → this.cache.set(key, data, ttlMs)
//   this.rangeCache.delete(key)      → this.cache.delete(key)
//   this.cleanupExpiredCache()       → (내부 자동 실행)
//
// [등록 방법]
//   MonitoringModule의 providers + exports에 CacheService를 추가하면
//   같은 모듈 내 서비스에서 constructor 주입으로 사용 가능.
//   다른 모듈에서 사용하려면 해당 모듈에서도 import 필요.
//
// [주의사항]
//   - 프로세스 메모리 기반이므로 서버 재시작 시 캐시 소멸
//   - 단일 인스턴스 환경 전용 (멀티 인스턴스 시 Redis 권장)
//   - 대량 데이터 캐싱 시 메모리 사용량 모니터링 필요
// ============================================================

import { Injectable, Logger } from '@nestjs/common';

/**
 * 캐시 엔트리 내부 구조
 * @property data      - 캐싱된 실제 데이터
 * @property timestamp - 저장 시점 (Date.now() ms)
 * @property ttl       - 유효 시간 (ms) — timestamp + ttl 경과 시 만료
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 범용 인메모리 캐시 서비스
 *
 * monitoring.service.ts의 rangeCache 로직을 추출하여 공통화.
 * 다른 서비스(dashboard, analysis)에서도 동일 패턴으로 재사용 가능.
 *
 * @example
 * ```ts
 * // NestJS Module에서 등록
 * @Module({ providers: [CacheService] })
 *
 * // Service에서 의존성 주입
 * constructor(private readonly cache: CacheService) {}
 *
 * // 캐시 조회 (타입 안전)
 * const cached = this.cache.get<RangeDataResponse>(cacheKey);
 * if (cached) return cached; // 캐시 HIT
 *
 * // 데이터 조회 후 캐시 저장
 * const data = await this.queryDatabase(...);
 * this.cache.set(cacheKey, data, 60_000); // 60초 TTL
 *
 * // 관련 캐시 일괄 무효화
 * this.cache.invalidateByPrefix('facility:HNK10');
 * ```
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  /** 캐시 저장소 — 키: 캐시 식별자, 값: 데이터+메타 */
  private readonly store = new Map<string, CacheEntry<any>>();

  constructor() {
    // 5분(300초)마다 만료된 엔트리를 일괄 정리하는 타이머 등록
    // → lazy expiration(get 호출 시)만으로는 조회되지 않는 키가 메모리에 남으므로
    //   주기적 cleanup으로 메모리 누수 방지
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 캐시에서 데이터 조회
   *
   * 만료된 엔트리는 자동 삭제 후 null 반환 (lazy expiration).
   *
   * @typeParam T - 반환 데이터 타입 (제네릭)
   * @param key - 캐시 키 (예: 'HNK10-000:power:1m:2026-03-12T00:00:00Z:...')
   * @returns 캐시 HIT 시 데이터, 만료 또는 미존재 시 null
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // 현재 시각과 저장 시점의 차이가 TTL을 초과하면 만료 처리
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 캐시에 데이터 저장
   *
   * 동일 키가 이미 존재하면 덮어쓰기 (갱신).
   *
   * @typeParam T - 저장 데이터 타입
   * @param key  - 캐시 키
   * @param data - 저장할 데이터
   * @param ttl  - 캐시 유효 시간 (밀리초)
   *               예: 60_000 = 1분, 300_000 = 5분
   */
  set<T>(key: string, data: T, ttl: number): void {
    this.store.set(key, { data, timestamp: Date.now(), ttl });
  }

  /**
   * 특정 키의 캐시 삭제
   *
   * @param key - 삭제할 캐시 키
   * @returns 삭제 성공 여부 (존재하지 않으면 false)
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 접두사 기반 캐시 일괄 무효화
   *
   * 설비나 라인 데이터 변경 시 관련 캐시를 한 번에 제거할 때 사용.
   *
   * @param prefix - 키 접두사 (예: 'HNK10-000:' → 해당 설비의 모든 캐시 삭제)
   * @returns 삭제된 엔트리 수
   *
   * @example
   * ```ts
   * // 특정 설비의 모든 캐시 무효화
   * const count = this.cache.invalidateByPrefix('HNK10-000:');
   * this.logger.log(`Invalidated ${count} cache entries`);
   *
   * // 특정 라인의 모든 캐시 무효화
   * this.cache.invalidateByPrefix('line:HNK10:');
   * ```
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** 현재 캐시에 저장된 엔트리 수 (디버깅/모니터링용) */
  get size(): number {
    return this.store.size;
  }

  /**
   * 만료된 엔트리 일괄 정리 (5분마다 자동 실행)
   *
   * get()의 lazy expiration으로 처리되지 않는 (조회되지 않는)
   * 만료 엔트리를 주기적으로 제거하여 메모리 누수를 방지한다.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries (remaining: ${this.store.size})`);
    }
  }
}
