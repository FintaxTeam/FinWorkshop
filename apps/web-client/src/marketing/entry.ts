const appPaths = new Set([
  '/admin', '/app', '/transactions', '/payments', '/reconciliation', '/invoices',
  '/reports', '/quotations', '/catalog', '/workshop', '/inventory',
  '/customers', '/suppliers', '/settings',
]);

export function safeAppDestination(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//') || /^\/\\/.test(candidate) || /[\r\n\\]/.test(candidate)) return '/app';
  const pathOnly = candidate.split(/[?#]/)[0];
  if (/\s/.test(pathOnly)) return '/app';
  try {
    const destination = new URL(candidate, window.location.origin);
    if (destination.origin !== window.location.origin || !appPaths.has(destination.pathname)) return '/app';
    return destination.pathname + destination.search + destination.hash;
  } catch { return '/app'; }
}
