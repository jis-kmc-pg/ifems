import axios from 'axios';
import { API_BASE_URL } from '../lib/constants';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ifems_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ifems_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// 목업 지연 시뮬레이션
export function mockDelay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}
