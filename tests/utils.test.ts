import { cn, formatDate, truncate, getPlatformIcon } from '../src/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
    });

    it('should handle conditional classes', () => {
      expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
    });

    it('should merge tailwind classes (later wins)', () => {
      expect(cn('px-4', 'px-6')).toBe('px-6');
    });
  });

  describe('formatDate', () => {
    it('should format a date string', () => {
      const result = formatDate('2026-01-15T10:30:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('should format a Date object', () => {
      const result = formatDate(new Date('2026-06-01T14:00:00Z'));
      expect(result).toContain('Jun');
    });
  });

  describe('truncate', () => {
    it('should return the string if within length', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('should truncate and add ellipsis', () => {
      expect(truncate('Hello World', 5)).toBe('Hello...');
    });

    it('should handle empty string', () => {
      expect(truncate('', 5)).toBe('');
    });
  });

  describe('getPlatformIcon', () => {
    it('should return facebook for messenger', () => {
      expect(getPlatformIcon('messenger')).toBe('facebook');
    });

    it('should return instagram for instagram', () => {
      expect(getPlatformIcon('instagram')).toBe('instagram');
    });
  });
});
