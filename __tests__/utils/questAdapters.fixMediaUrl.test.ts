// __tests__/utils/questAdapters.fixMediaUrl.test.ts
import { fixMediaUrl } from '@/utils/questAdapters';

describe('fixMediaUrl', () => {
    it('should fix double host without slash (dev environment)', () => {
        const input = 'http://192.168.50.36https://metravellocal.s3.amazonaws.com/quests/5/poster/video.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAJ2XBPKC6ITB3S5RQ%2F20260224%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20260224T215129Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=a4b58db8480df6bbe220c3e027d85f99cdd41ac28dc431bb0f6dbc4575f0a95c';
        const result = fixMediaUrl(input);
        
        expect(result).toBe('https://metravellocal.s3.amazonaws.com/quests/5/poster/video.mp4');
        expect(result).not.toContain('192.168.50.36');
        expect(result).not.toContain('X-Amz-Signature');
    });

    it('should fix double host without slash (prod environment)', () => {
        const input = 'https://metravel.byhttps://metravelprod.s3.amazonaws.com/quests/1/video.mp4';
        const result = fixMediaUrl(input);
        
        expect(result).toBe('https://metravelprod.s3.amazonaws.com/quests/1/video.mp4');
        expect(result).not.toContain('metravel.by');
    });

    it('should fix double host with port', () => {
        const input = 'http://localhost:8000https://s3.amazonaws.com/bucket/video.mp4';
        const result = fixMediaUrl(input);
        
        expect(result).toBe('https://s3.amazonaws.com/bucket/video.mp4');
        expect(result).not.toContain('localhost');
    });

    it('should not modify valid URLs', () => {
        const validUrls = [
            'https://metravelprod.s3.amazonaws.com/quests/1/video.mp4',
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://example.com/video.mp4',
        ];

        validUrls.forEach(url => {
            expect(fixMediaUrl(url)).toBe(url);
        });
    });

    it('should handle null and undefined', () => {
        expect(fixMediaUrl(null)).toBeUndefined();
        expect(fixMediaUrl(undefined)).toBeUndefined();
        expect(fixMediaUrl('')).toBeUndefined();
    });

    it('should preserve YouTube URLs', () => {
        const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        expect(fixMediaUrl(youtubeUrl)).toBe(youtubeUrl);
    });

    it('should not break URLs with query params containing https', () => {
        const url = 'https://example.com/video?redirect=https://other.com';
        expect(fixMediaUrl(url)).toBe(url);
    });
});
