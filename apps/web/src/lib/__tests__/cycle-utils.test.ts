import { describe, it, expect } from 'vitest';
import { intervalToSeconds, normalizeToRelativeTime, mergeOverlayData } from '../cycle-utils';
import type { TimeSeriesPoint } from '../../types/chart';

describe('cycle-utils', () => {
  describe('intervalToSeconds', () => {
    it('should convert intervals to seconds', () => {
      expect(intervalToSeconds('1s')).toBe(1);
      expect(intervalToSeconds('10s')).toBe(10);
      expect(intervalToSeconds('1m')).toBe(60);
      expect(intervalToSeconds('15m')).toBe(900);
    });
  });

  describe('normalizeToRelativeTime', () => {
    it('should normalize 10s interval data', () => {
      const data: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01T11:00:00Z', value: 850 },
        { timestamp: '2024-01-01T11:00:10Z', value: 860 },
        { timestamp: '2024-01-01T11:00:20Z', value: 870 },
      ];
      const result = normalizeToRelativeTime(data, '2024-01-01T11:00:00Z', '10s');
      expect(result).toEqual([
        { sec: 0, value: 850 },
        { sec: 10, value: 860 },
        { sec: 20, value: 870 },
      ]);
    });

    it('should normalize 1s interval data', () => {
      const data: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01T11:00:00Z', value: 850 },
        { timestamp: '2024-01-01T11:00:01Z', value: 851 },
        { timestamp: '2024-01-01T11:00:02Z', value: 852 },
      ];
      const result = normalizeToRelativeTime(data, '2024-01-01T11:00:00Z', '1s');
      expect(result).toEqual([
        { sec: 0, value: 850 },
        { sec: 1, value: 851 },
        { sec: 2, value: 852 },
      ]);
    });

    it('should handle empty data', () => {
      const result = normalizeToRelativeTime([], '2024-01-01T11:00:00Z', '10s');
      expect(result).toEqual([]);
    });
  });

  describe('mergeOverlayData', () => {
    it('should merge three series', () => {
      const ref = [{ sec: 0, value: 850 }, { sec: 10, value: 860 }];
      const compare1 = [{ sec: 0, value: 880 }, { sec: 10, value: 890 }];
      const compare2 = [{ sec: 0, value: 920 }];
      const result = mergeOverlayData(ref, compare1, compare2);
      expect(result).toEqual([
        { sec: 0, refValue: 850, compare1Value: 880, compare2Value: 920 },
        { sec: 10, refValue: 860, compare1Value: 890, compare2Value: undefined },
      ]);
    });

    it('should handle undefined series', () => {
      const ref = [{ sec: 0, value: 850 }];
      const result = mergeOverlayData(ref, undefined, undefined);
      expect(result).toEqual([
        { sec: 0, refValue: 850, compare1Value: undefined, compare2Value: undefined },
      ]);
    });
  });
});
