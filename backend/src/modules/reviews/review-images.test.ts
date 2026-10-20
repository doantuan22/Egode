import { describe, it, expect } from 'vitest';
import { validateReviewImages, MAX_REVIEW_IMAGES } from './review-images';

const tinyPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAg1WvHmoAAAAASUVORK5CYII=';

describe('validateReviewImages', () => {
  it('accepts a valid PNG data URI', () => {
    expect(() => validateReviewImages([tinyPngDataUri])).not.toThrow();
  });

  it('accepts undefined/empty (images are optional)', () => {
    expect(() => validateReviewImages(undefined)).not.toThrow();
    expect(() => validateReviewImages([])).not.toThrow();
  });

  it('rejects a non-data-URI string', () => {
    expect(() => validateReviewImages(['not-an-image'])).toThrow(/data URI/i);
  });

  it('rejects an unsupported mime type', () => {
    expect(() => validateReviewImages(['data:application/pdf;base64,JVBERi0xLjQK'])).toThrow(/JPEG|PNG|WEBP|GIF/i);
  });

  it(`rejects more than ${MAX_REVIEW_IMAGES} images`, () => {
    const many = Array.from({ length: MAX_REVIEW_IMAGES + 1 }, () => tinyPngDataUri);
    expect(() => validateReviewImages(many)).toThrow(/Tối đa/);
  });

  it('rejects an oversized image (> 5MB decoded)', () => {
    const hugeBase64 = 'iVBORw0KGgo'.padEnd(8_000_000, 'A');
    expect(() => validateReviewImages([`data:image/png;base64,${hugeBase64}`])).toThrow(/5MB/);
  });

  it('rejects MIME spoofing when decoded magic bytes do not match', () => {
    expect(() => validateReviewImages(['data:image/png;base64,JVBERi0xLjQK'])).toThrow(/định dạng/i);
  });
});
