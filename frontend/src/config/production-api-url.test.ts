import { describe, expect, it } from 'vitest';
import { validateProductionApiBaseUrl } from '../../build/production-api-url';

describe('production VITE_API_BASE_URL validation', () => {
  it('requires an explicitly configured API URL', () => {
    expect(() => validateProductionApiBaseUrl(undefined)).toThrow(/VITE_API_BASE_URL is required/);
    expect(() => validateProductionApiBaseUrl('   ')).toThrow(/VITE_API_BASE_URL is required/);
  });

  it('accepts an HTTPS API URL for production builds', () => {
    expect(() => validateProductionApiBaseUrl('https://api.example.invalid/api')).not.toThrow();
  });

  it.each([
    'http://api.example.invalid/api',
    'https://localhost:5000/api',
    'https://127.0.0.1/api',
    'https://api.example.invalid',
    'https://user:password@api.example.invalid/api',
    'https://api.example.invalid/api?debug=true',
  ])('rejects unsafe or incomplete production URL %s', (url) => {
    expect(() => validateProductionApiBaseUrl(url)).toThrow(/VITE_API_BASE_URL/);
  });
});
