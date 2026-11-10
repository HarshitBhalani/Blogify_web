// In development the CRA proxy (package.json "proxy") forwards /api to the Express server.
// The login session is an httpOnly cookie set by the server: nothing secret is stored in
// localStorage, and page JavaScript cannot read the session at all.
const BASE = '/api';

const headers = (json = true) => {
  // The server rejects write requests without this header (CSRF guard).
  const h = { 'X-Requested-With': 'blogify' };
  if (json) h['Content-Type'] = 'application/json';
  return h;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    signal,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError((data && data.message) || `Request failed (${res.status})`, res.status);
  }
  if (data === null) {
    // Usually the dev server answered with index.html because the /api proxy is not active.
    throw new ApiError('The API did not respond. Restart "npm run dev" and make sure the server is running.', 0);
  }
  return data;
}

// Streams plain text from the server, calling onChunk with the full text so far.
export async function streamText(path, body, onChunk, signal) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body),
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).message || message;
    } catch (error) {
      // not JSON
    }
    throw new ApiError(message, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onChunk(text);
  }
  return text;
}
