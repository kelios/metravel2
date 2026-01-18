import { 
  PointColor, 
  PointCategory, 
  PointStatus,
  COLOR_CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS
} from '@/types/userPoints';

describe('UserPoints Types', () => {
  describe('PointColor enum', () => {
    it('should have all required colors', () => {
      expect(PointColor.GREEN).toBe('green');
      expect(PointColor.PURPLE).toBe('purple');
      expect(PointColor.YELLOW).toBe('yellow');
      expect(PointColor.BLUE).toBe('blue');
      expect(PointColor.RED).toBe('red');
      expect(PointColor.BROWN).toBe('brown');
      expect(PointColor.GRAY).toBe('gray');
    });
  });

  describe('PointCategory enum', () => {
    it('should have all required categories', () => {
      expect(PointCategory.MOUNTAIN).toBe('mountain');
      expect(PointCategory.LAKE).toBe('lake');
      expect(PointCategory.FOREST).toBe('forest');
      expect(PointCategory.BEACH).toBe('beach');
      expect(PointCategory.PARK).toBe('park');
      expect(PointCategory.CASTLE).toBe('castle');
      expect(PointCategory.CHURCH).toBe('church');
      expect(PointCategory.MONUMENT).toBe('monument');
      expect(PointCategory.MUSEUM).toBe('museum');
      expect(PointCategory.RESTAURANT).toBe('restaurant');
      expect(PointCategory.CAFE).toBe('cafe');
      expect(PointCategory.HOTEL).toBe('hotel');
      expect(PointCategory.SHOP).toBe('shop');
      expect(PointCategory.THEATER).toBe('theater');
      expect(PointCategory.CINEMA).toBe('cinema');
      expect(PointCategory.ATTRACTION).toBe('attraction');
      expect(PointCategory.OTHER).toBe('other');
    });
  });

  describe('PointStatus enum', () => {
    it('should have all required statuses', () => {
      expect(PointStatus.VISITED).toBe('visited');
      expect(PointStatus.WANT_TO_VISIT).toBe('want_to_visit');
      expect(PointStatus.PLANNING).toBe('planning');
      expect(PointStatus.ARCHIVED).toBe('archived');
    });
  });

  describe('COLOR_CATEGORIES', () => {
    it('should map all colors to their properties', () => {
      expect(COLOR_CATEGORIES[PointColor.GREEN]).toEqual({
        label: 'Посещено',
        icon: 'check-circle',
        description: 'Места, где я уже была',
        color: '#4CAF50'
      });
      expect(COLOR_CATEGORIES[PointColor.PURPLE]).toEqual({
        label: 'Мечта',
        icon: 'star',
        description: 'Очень хочу посетить',
        color: '#9C27B0'
      });
      expect(COLOR_CATEGORIES[PointColor.YELLOW]).toEqual({
        label: 'В работе',
        icon: 'clock',
        description: 'Планирование маршрута',
        color: '#FFC107'
      });
      expect(COLOR_CATEGORIES[PointColor.BLUE]).toEqual({
        label: 'Планирую',
        icon: 'calendar',
        description: 'В планах на посещение',
        color: '#2196F3'
      });
      expect(COLOR_CATEGORIES[PointColor.GRAY]).toEqual({
        label: 'Архив',
        icon: 'archive',
        description: 'Неактуальные места',
        color: '#9E9E9E'
      });
      expect(COLOR_CATEGORIES[PointColor.RED]).toEqual({
        label: 'Избранное',
        icon: 'heart',
        description: 'Любимые места',
        color: '#F44336'
      });
      expect(COLOR_CATEGORIES[PointColor.BROWN]).toEqual({
        label: 'Интересное',
        icon: 'map-pin',
        description: 'Интересные места',
        color: '#795548'
      });
    });

    it('should have entries for all color enum values', () => {
      const colorKeys = Object.values(PointColor);
      const categoryKeys = Object.keys(COLOR_CATEGORIES);
      
      expect(categoryKeys.length).toBe(colorKeys.length);
      colorKeys.forEach(color => {
        expect(COLOR_CATEGORIES[color]).toBeDefined();
      });
    });
  });

  describe('CATEGORY_LABELS', () => {
    it('should have labels for all categories', () => {
      expect(CATEGORY_LABELS[PointCategory.RESTAURANT]).toBe('Ресторан');
      expect(CATEGORY_LABELS[PointCategory.HOTEL]).toBe('Отель');
      expect(CATEGORY_LABELS[PointCategory.ATTRACTION]).toBe('Достопримечательность');
      expect(CATEGORY_LABELS[PointCategory.OTHER]).toBe('Другое');
    });

    it('should have entries for all category enum values', () => {
      const categoryKeys = Object.values(PointCategory);
      const labelKeys = Object.keys(CATEGORY_LABELS);
      
      expect(labelKeys.length).toBe(categoryKeys.length);
      categoryKeys.forEach(category => {
        expect(CATEGORY_LABELS[category]).toBeDefined();
      });
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
