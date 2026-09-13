let authHeader: string | undefined;

// These are same-Docker-network calls to our own plugin-runner/python-runner
// containers, so a healthy response should always be fast. Without a timeout,
// a stalled peer hangs the caller's fetch forever with no error and no log,
// which blocks the whole message queue behind it (see queue.ts's watchdog for
// the equivalent problem on the provider call).
const INTERNAL_FETCH_TIMEOUT_MS = 30_000;

export function initInternalFetch(password: string): void {
  // Basic Auth with an empty username: base64(":password").
  authHeader = `Basic ${Buffer.from(`:${password}`).toString("base64")}`;
}

export async function internalFetch(url: string, init?: RequestInit): Promise<Response> {
  if (authHeader === undefined) {
    throw new Error("internalFetch called before initInternalFetch");
  }

  const existingHeaders = init?.headers;
  let mergedHeaders: Record<string, string>;

  if (existingHeaders === undefined) {
    mergedHeaders = { "Authorization": authHeader };
  } else if (existingHeaders instanceof Headers) {
    mergedHeaders = { "Authorization": authHeader };
    existingHeaders.forEach((value, key) => {
      mergedHeaders[key] = value;
    });
  } else if (Array.isArray(existingHeaders)) {
    mergedHeaders = { "Authorization": authHeader };
    for (const [key, value] of existingHeaders) {
      mergedHeaders[key] = value;
    }
  } else {
    mergedHeaders = { "Authorization": authHeader, ...(existingHeaders as Record<string, string>) };
  }

  const timeoutSignal = AbortSignal.timeout(INTERNAL_FETCH_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

  return fetch(url, { ...init, headers: mergedHeaders, signal });
}
