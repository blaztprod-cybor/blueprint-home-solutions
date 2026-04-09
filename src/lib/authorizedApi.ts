import { auth } from '../firebase';

export async function authorizedApiFetch(input: string, init: RequestInit = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user is available for this request.');
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
