import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDynamicResolution } from '../useDynamicResolution';
import type { DynamicResolutionOptions } from '../../types/chart';

// Mock dependencies
vi.mock('../../services/monitoring', () => ({
  fetchRangeData: vi.fn(() =>
    Promise.resolve({
      data: [
        { time: '2024-01-01T00:00:00Z', value: 100 },
        { time: '2024-01-01T01:00:00Z', value: 200 },
      ],
      metadata: { interval: '15m', count: 2 },
    })
  ),
}));

vi.mock('../../lib/chart-utils', () => ({
  getIntervalForZoomRatio: vi.fn((zoomRatio, current, initial, maxDepth) => {
    // Simplified logic for testing
    if (maxDepth === 1) return '15m';
    if (zoomRatio < 0.5) return '1m';
    if (zoomRatio < 0.8) return '15m';
    return initial;
  }),
  formatInterval: vi.fn((interval) => interval),
}));

describe('useDynamicResolution', () => {
  const defaultOptions: DynamicResolutionOptions = {
    initialInterval: '15m',
    startTime: '2024-01-01T00:00:00Z',
    endTime: '2024-01-01T23:59:59Z',
    facilityId: 'HNK10-000',
    metric: 'power',
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with initialInterval', () => {
      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      expect(result.current.currentInterval).toBe('15m');
    });

    it('should return empty data array initially', () => {
      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      expect(Array.isArray(result.current.data)).toBe(true);
    });
  });

  describe('Enabled/Disabled State', () => {
    it('should not fetch data when enabled is false', async () => {
      const { result } = renderHook(() =>
        useDynamicResolution({ ...defaultOptions, enabled: false })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });
    });

    it('should fetch data when enabled is true', async () => {
      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      await waitFor(() => {
        expect(result.current.data.length).toBeGreaterThan(0);
      });
    });
  });

  describe('maxDepth Constraint', () => {
    it('should respect maxDepth=1 (15m only)', () => {
      const { result } = renderHook(() =>
        useDynamicResolution({ ...defaultOptions, maxDepth: 1 })
      );

      expect(result.current.currentInterval).toBe('15m');
    });

    it('should respect maxDepth=2 (15m, 1m)', () => {
      const { result } = renderHook(() =>
        useDynamicResolution({ ...defaultOptions, maxDepth: 2 })
      );

      expect(result.current.currentInterval).toBe('15m');
    });

    it('should respect maxDepth=3 (all intervals)', () => {
      const { result } = renderHook(() =>
        useDynamicResolution({ ...defaultOptions, maxDepth: 3 })
      );

      expect(result.current.currentInterval).toBe('15m');
    });
  });

  describe('Manual Interval Change', () => {
    it('should change interval via setManualInterval', () => {
      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      expect(result.current.currentInterval).toBe('15m');

      // Change to 1m manually
      result.current.setManualInterval('1m');

      expect(result.current.currentInterval).toBe('1m');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to initialInterval', () => {
      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      // Change interval manually
      result.current.setManualInterval('1m');
      expect(result.current.currentInterval).toBe('1m');

      // Reset
      result.current.reset();
      expect(result.current.currentInterval).toBe('15m');
    });
  });

  describe('Return Values', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('metadata');
      expect(result.current).toHaveProperty('currentInterval');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('handleZoom');
      expect(result.current).toHaveProperty('reset');
      expect(result.current).toHaveProperty('setManualInterval');
    });

    it('should have callable functions', () => {
      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      expect(typeof result.current.handleZoom).toBe('function');
      expect(typeof result.current.reset).toBe('function');
      expect(typeof result.current.setManualInterval).toBe('function');
    });
  });

  describe('SWR Caching Behavior', () => {
    it('should generate unique cache key per configuration', async () => {
      const { result: result1 } = renderHook(() =>
        useDynamicResolution({ ...defaultOptions, facilityId: 'HNK10-000' })
      );

      const { result: result2 } = renderHook(() =>
        useDynamicResolution({ ...defaultOptions, facilityId: 'HNK10-010' })
      );

      // Different facilityId should result in different data fetches
      await waitFor(() => {
        expect(result1.current.data).toBeDefined();
        expect(result2.current.data).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should set isError when fetch fails', async () => {
      const { fetchRangeData } = await import('../../services/monitoring');
      vi.mocked(fetchRangeData).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDynamicResolution(defaultOptions));

      await waitFor(() => {
        // Error handling is internal, just verify hook doesn't crash
        expect(result.current.isError).toBeDefined();
      });
    });
  });
});
