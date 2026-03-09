// ============================================================
// i-FEMS 서비스 공통 헬퍼
// ============================================================
// 모든 서비스 함수의 Mock/API 분기 + axios 호출 패턴을 1줄로 축약
// 변경 시 이 파일 하나만 수정하면 전체 반영

import { USE_MOCK } from '../lib/constants';
import { mockDelay, apiClient } from './api';

/** GET 요청 — 대부분의 조회 API에 사용 */
export async function fetchApi<T>(mockData: T, path: string, params?: Record<string, unknown>): Promise<T> {
  if (USE_MOCK) return mockDelay(mockData);
  return apiClient.get(path, { params }).then((r) => r.data);
}

/** POST 요청 — 생성 API */
export async function postApi<T>(mockData: T, path: string, body?: unknown): Promise<T> {
  if (USE_MOCK) return mockDelay(mockData);
  return apiClient.post(path, body).then((r) => r.data);
}

/** PUT 요청 — 수정/저장 API */
export async function putApi<T>(mockData: T, path: string, body?: unknown): Promise<T> {
  if (USE_MOCK) return mockDelay(mockData);
  return apiClient.put(path, body).then((r) => r.data);
}

/** PATCH 요청 — 부분 수정 API */
export async function patchApi<T>(mockData: T, path: string, body?: unknown): Promise<T> {
  if (USE_MOCK) return mockDelay(mockData);
  return apiClient.patch(path, body).then((r) => r.data);
}

/** DELETE 요청 — 삭제 API */
export async function deleteApi<T>(mockData: T, path: string): Promise<T> {
  if (USE_MOCK) return mockDelay(mockData);
  return apiClient.delete(path).then((r) => r.data);
}
