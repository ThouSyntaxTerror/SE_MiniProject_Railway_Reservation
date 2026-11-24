// api/client.js: the only module that talks to the REST API (architecture doc: the Web UI never
// touches the database). These tests check the headers it sends and how it reports failures.
import { describe, expect, test, vi } from 'vitest';
import { ApiError, apiFetch, clearSession, getToken, getUser, setToken, setUser } from '../api/client.js';
import { fakeApi } from './fakeApi.js';

describe('apiFetch', () => {
  test('sends the bearer token when signed in, and none when not', async () => {
    const calls = fakeApi({ 'GET /bookings': () => [200, []] });

    await apiFetch('/bookings');
    setToken('abc123');
    await apiFetch('/bookings');

    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[1].headers.Authorization).toBe('Bearer abc123');
  });

  test('sends the Idempotency-Key and a JSON body for a booking (FR-05)', async () => {
    const calls = fakeApi({ 'POST /bookings': () => [201, { id: 1 }] });

    await apiFetch('/bookings', { method: 'POST', body: { tripId: 7 }, idempotencyKey: 'k-1' });

    expect(calls[0]).toMatchObject({ method: 'POST', body: { tripId: 7 } });
    expect(calls[0].headers['Idempotency-Key']).toBe('k-1');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
  });

  test('returns null for 204 No Content', async () => {
    fakeApi({ 'DELETE /sessions/current': () => [204, null] });

    await expect(apiFetch('/sessions/current', { method: 'DELETE' })).resolves.toBeNull();
  });

  test('turns an error response into an ApiError with the server code and message', async () => {
    fakeApi({ 'POST /bookings': () => [409, { code: 'SEAT_UNAVAILABLE', message: 'No seats available on this trip.' }] });

    const err = await apiFetch('/bookings', { method: 'POST', body: { tripId: 1 } }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'SEAT_UNAVAILABLE', message: 'No seats available on this trip.' });
  });

  test('falls back to a generic message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));

    await expect(apiFetch('/trips')).rejects.toMatchObject({ status: 502, message: 'Request failed (502)' });
  });

  test('a 401 clears the stored session so the app returns to sign-in (SEC-03)', async () => {
    setToken('expired');
    setUser({ id: 1, name: 'A' });
    fakeApi({ 'GET /bookings': () => [401, { code: 'UNAUTHENTICATED', message: 'Sign in again.' }] });

    await expect(apiFetch('/bookings')).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  test('other errors leave the session alone', async () => {
    setToken('still-valid');
    fakeApi({ 'GET /admin/trips': () => [403, { code: 'FORBIDDEN', message: 'Administrators only.' }] });

    await expect(apiFetch('/admin/trips')).rejects.toMatchObject({ status: 403 });
    expect(getToken()).toBe('still-valid');
  });
});

describe('session storage helpers', () => {
  test('store and clear the token and user', () => {
    setToken('t');
    setUser({ id: 2, name: 'B', role: 'admin' });
    expect(getToken()).toBe('t');
    expect(getUser()).toEqual({ id: 2, name: 'B', role: 'admin' });

    clearSession();
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  test('a corrupted stored user reads as signed out instead of crashing', () => {
    localStorage.setItem('rrs_user', '{not json');
    expect(getUser()).toBeNull();
  });
});
