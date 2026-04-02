const isBrowser = typeof window !== 'undefined';
const isLocalhost =
  isBrowser &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Quando o backend estiver no Render, coloca o link gerado aqui
// Exemplo: 'https://ifound-backend-xyz.onrender.com'
const PRODUCTION_APIURL = ''; 

const backendOrigin = isLocalhost ? 'http://localhost:5000' : PRODUCTION_APIURL;

export const API_BASE_URL = `${backendOrigin}/api`;

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function resolveBackendUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return backendOrigin ? `${backendOrigin}${path}` : path;
}
