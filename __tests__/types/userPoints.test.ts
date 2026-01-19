import { 
  PointStatus,
  STATUS_LABELS
} from '@/types/userPoints';

describe('UserPoints Types', () => {
  describe('PointStatus enum', () => {
    it('should have all required statuses', () => {
      expect(PointStatus.VISITED).toBe('visited');
      expect(PointStatus.WANT_TO_VISIT).toBe('want_to_visit');
      expect(PointStatus.PLANNING).toBe('planning');
      expect(PointStatus.ARCHIVED).toBe('archived');
    });
  });

  describe('STATUS_LABELS', () => {
    it('should have labels for all statuses', () => {
      expect(STATUS_LABELS[PointStatus.VISITED]).toBe('Посещено');
      expect(STATUS_LABELS[PointStatus.WANT_TO_VISIT]).toBe('Хочу посетить');
      expect(STATUS_LABELS[PointStatus.PLANNING]).toBe('Планирую');
      expect(STATUS_LABELS[PointStatus.ARCHIVED]).toBe('Архив');
    });

    it('should have entries for all status enum values', () => {
      const statusKeys = Object.values(PointStatus);
      const labelKeys = Object.keys(STATUS_LABELS);
      
      expect(labelKeys.length).toBe(statusKeys.length);
      statusKeys.forEach(status => {
        expect(STATUS_LABELS[status]).toBeDefined();
      });
    });
  });
});
