import { assertSafePublicUrl } from '@gotcha/shared/dist/safe-url';

const MAX_REDIRECTS = 3;

export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafePublicUrl(current, 'URL');
    const response = await fetch(current, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30_000),
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The site returned a redirect without a destination.');
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error('The site redirected too many times.');
}
