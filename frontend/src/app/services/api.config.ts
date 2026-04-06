export const API_BASE_URL = '/api';

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function resolveBackendUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return path;
}
