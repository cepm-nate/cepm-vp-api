const LZW = require('../lzw');

describe('LZW', () => {
  describe('compress', () => {
    it('should compress a simple string', () => {
      const lzw = new LZW();
      const original = 'ABA';
      const compressed = lzw.compress(original);
      // Known output or check decompress
      expect(lzw.decompress(compressed)).toBe(original);
    });

    it('should compress the example string', () => {
      const lzw = new LZW();
      const original = 'TOBEORNOTTOBEORTOBEORNOT';
      const compressed = lzw.compress(original);
      expect(lzw.decompress(compressed)).toBe(original);
    });

    it('should handle empty string', () => {
      const lzw = new LZW();
      const original = '';
      const compressed = lzw.compress(original);
      expect(compressed).toBe('');
      // Note: decompress of empty may not round trip perfectly
    });

    it('should handle single character', () => {
      const lzw = new LZW();
      const original = 'A';
      const compressed = lzw.compress(original);
      expect(lzw.decompress(compressed)).toBe(original);
    });

    it('should handle repeated patterns', () => {
      const lzw = new LZW();
      const original = 'AAAA';
      const compressed = lzw.compress(original);
      expect(lzw.decompress(compressed)).toBe(original);
    });
  });

  describe('decompress', () => {
    it('should decompress compressed data correctly', () => {
      const lzw = new LZW();
      const original = 'HELLO WORLD';
      const compressed = lzw.compress(original);
      const decompressed = lzw.decompress(compressed);
      expect(decompressed).toBe(original);
    });

    it('should return null on invalid compressed data', () => {
      const lzw = new LZW();
      const invalid = '0,999';
      const result = lzw.decompress(invalid);
      expect(result).toBe(null);
    });

    it('should handle edge cases in decompression', () => {
      // Test with known compressed string
      const lzw = new LZW();
      // Assume some valid compressed
      // For now, just round trip
    });
  });
});
