export const validateProductionApiBaseUrl = (value: string | undefined): void => {
  if (!value?.trim()) {
    throw new Error('[vite] VITE_API_BASE_URL is required for production builds (for example https://<api-host>/api).');
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(value);
  } catch {
    throw new Error('[vite] VITE_API_BASE_URL must be an absolute HTTPS URL ending in /api.');
  }

  if (
    apiUrl.protocol !== 'https:' ||
    ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(apiUrl.hostname.toLowerCase()) ||
    apiUrl.hostname.toLowerCase().endsWith('.localhost') ||
    !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api') ||
    apiUrl.search ||
    apiUrl.hash ||
    apiUrl.username ||
    apiUrl.password
  ) {
    throw new Error('[vite] VITE_API_BASE_URL must be an HTTPS API URL ending in /api, without localhost, credentials, query, or fragment.');
  }
};
