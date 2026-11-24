#!/usr/bin/env node
// Live system test: drives a RUNNING instance through its public HTTP API, the same calls the
// browser makes, and prints a PASS/FAIL line per check with the evidence it saw.
//
//   node scripts/systemTest.js                       # http://localhost:3000
//   node scripts/systemTest.js --base http://host:3000
//
// It needs the seeded demo administrator (npm run migrate) and creates its own throw-away users
// and one throw-away trip, so it can be re-run any number of times. Unlike the Jest suite it does
// not touch the database directly and cannot force a payment failure, so those cases stay in Jest.
// Requires Node 18+ (global fetch).

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rrs.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPassword123';
const RUN = Date.now().toString(36);
const PASSWORD = 'SystemTestPassword1';

let passed = 0;
let failed = 0;

function check(id, description, ok, evidence) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${description}`);
  if (evidence !== undefined) console.log(`        ${evidence}`);
}

async function call(method, path, { token, body, key } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['Idempotency-Key'] = key;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function newPassenger(label) {
  const email = `st-${label}-${RUN}@example.com`;
  await call('POST', '/api/register', { body: { name: `ST ${label}`, email, password: PASSWORD } });
  const login = await call('POST', '/api/sessions', { body: { email, password: PASSWORD } });
  return { email, token: login.body.token };
}

const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();
const dateOnly = (days) => iso(days).slice(0, 10);

async function main() {
  console.log(`System test against ${BASE}  (run id ${RUN})\n`);

  const health = await call('GET', '/health');
  check('ST-00', 'API is up', health.status === 200 && health.body.status === 'ok', `GET /health -> ${health.status}`);
  if (health.status !== 200) process.exit(2);

  const admin = await call('POST', '/api/sessions', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (admin.status !== 200) {
    console.log(`Cannot sign in as the demo administrator (${admin.status}). Run "npm run migrate" first.`);
    process.exit(2);
  }
  const adminToken = admin.body.token;

  // A throw-away trip so the checks never depend on, or disturb, the seeded timetable.
  const origin = `Origin-${RUN}`;
  const destination = `Dest-${RUN}`;
  const tripRes = await call('POST', '/api/admin/trips', {
    token: adminToken,
    body: {
      train_number: `ST-${RUN}`, origin, destination,
      departure_utc: iso(3), arrival_utc: iso(3.25), fare: 650, capacity: 3,
    },
  });
  const tripId = tripRes.body.id;
  check('ST-01', 'administrator creates a 3-seat trip', tripRes.status === 201 && tripRes.body.capacity === 3,
    `POST /api/admin/trips -> ${tripRes.status}, trip ${tripId}`);

  // ---- TC-02: sign-in, generic errors, lockout (FR-02, SEC-04, FR-09) ---------------------------
  const victim = await newPassenger('lock');
  const unknown = await call('POST', '/api/sessions', { body: { email: `nobody-${RUN}@example.com`, password: 'whatever12345' } });
  const wrong1 = await call('POST', '/api/sessions', { body: { email: victim.email, password: 'wrong-password-1' } });
  check('TC-02a', 'unknown email and wrong password give the same 401 and message',
    unknown.status === 401 && wrong1.status === 401 && unknown.body.message === wrong1.body.message,
    `unknown: ${unknown.status} "${unknown.body.message}" | wrong password: ${wrong1.status} "${wrong1.body.message}"`);

  const attempts = [wrong1.status];
  for (let i = 2; i <= 5; i += 1) {
    attempts.push((await call('POST', '/api/sessions', { body: { email: victim.email, password: `wrong-password-${i}` } })).status);
  }
  check('TC-02b', 'five wrong passwords are five 401s', attempts.every((s) => s === 401), `statuses: ${attempts.join(', ')}`);

  const locked = await call('POST', '/api/sessions', { body: { email: victim.email, password: PASSWORD } });
  check('TC-02c', 'sixth attempt is refused with 429 ACCOUNT_LOCKED even with the CORRECT password',
    locked.status === 429 && locked.body.code === 'ACCOUNT_LOCKED', `-> ${locked.status} ${locked.body.code}`);

  const audit = await call('GET', '/api/admin/audit?limit=200', { token: adminToken });
  const mine = (audit.body || []).filter((e) => e.actor_email === victim.email);
  const outcomes = [...new Set(mine.map((e) => `${e.action}:${e.outcome}`))].sort();
  check('TC-02d', 'failed attempts and the lock are in the audit trail',
    outcomes.some((o) => o === 'login:locked') && mine.filter((e) => e.action === 'login').length >= 6,
    `audit rows for this user: ${mine.length}; kinds: ${outcomes.join(', ')}`);
  const leaked = JSON.stringify(audit.body).includes(PASSWORD) || JSON.stringify(audit.body).includes('wrong-password');
  check('TC-02e', 'no password appears anywhere in the audit trail', !leaked);

  // ---- TC-03/TC-04: search, book, history (FR-03, FR-05, FR-06) -------------------------------
  const alice = await newPassenger('alice');
  const bob = await newPassenger('bob');
  const search = await call('GET', `/api/trips?origin=${origin}&destination=${destination}&date=${dateOnly(1)}`, { token: alice.token });
  check('TC-03', 'search finds the new trip by origin, destination and date',
    search.status === 200 && search.body.some((t) => t.id === tripId), `GET /api/trips -> ${search.status}, ${search.body.length} result(s)`);

  const avail0 = await call('GET', `/api/trips/${tripId}/availability`, { token: alice.token });
  const key = `st-book-${RUN}`;
  const booked = await call('POST', '/api/bookings', { token: alice.token, key, body: { tripId } });
  check('TC-04a', 'booking returns 201 with a PNR and a seat',
    booked.status === 201 && /^[A-Z0-9]{6,}$/.test(booked.body.pnr || '') && booked.body.seat_number > 0,
    `-> ${booked.status}, PNR ${booked.body.pnr}, seat ${booked.body.seat_number}`);
  const avail1 = await call('GET', `/api/trips/${tripId}/availability`, { token: alice.token });
  check('TC-04b', 'availability drops by exactly one', avail0.body.unreserved === 3 && avail1.body.unreserved === 2,
    `unreserved ${avail0.body.unreserved} -> ${avail1.body.unreserved}`);
  const history = await call('GET', '/api/bookings', { token: alice.token });
  const bobHistory = await call('GET', '/api/bookings', { token: bob.token });
  check('TC-04c', 'the booking is in the owner\'s history and not in another passenger\'s',
    history.body.some((b) => b.pnr === booked.body.pnr) && !bobHistory.body.some((b) => b.pnr === booked.body.pnr));

  // ---- TC-05: repeated submission (the payment-failure half cannot be forced on a live server) --
  const retry = await call('POST', '/api/bookings', { token: alice.token, key, body: { tripId } });
  const afterRetry = await call('GET', `/api/trips/${tripId}/availability`, { token: alice.token });
  check('TC-05', 'the same Idempotency-Key returns the same booking and takes no second seat',
    retry.body.id === booked.body.id && afterRetry.body.unreserved === 2,
    `retry -> booking ${retry.body.id} (original ${booked.body.id}); unreserved ${afterRetry.body.unreserved}`);

  // ---- TC-06: ownership and cancellation (FR-07, SEC-01) ---------------------------------------
  const stranger = await call('POST', `/api/bookings/${booked.body.id}/cancel`, { token: bob.token });
  const strangerText = JSON.stringify(stranger.body);
  check('TC-06a', 'another passenger cannot cancel it: 404 and no PNR in the response',
    stranger.status === 404 && !strangerText.includes(booked.body.pnr), `-> ${stranger.status} ${stranger.body.code}`);
  const stillConfirmed = (await call('GET', '/api/bookings', { token: alice.token })).body.find((b) => b.id === booked.body.id);
  check('TC-06b', 'the failed attempt left the booking confirmed', stillConfirmed.status === 'confirmed');

  const cancelled = await call('POST', `/api/bookings/${booked.body.id}/cancel`, { token: alice.token });
  check('TC-06c', 'the owner cancels and gets the refund reference RFND-<PNR>',
    cancelled.status === 200 && cancelled.body.status === 'cancelled' && cancelled.body.refundReference === `RFND-${booked.body.pnr}`,
    `-> ${cancelled.status}, ${cancelled.body.refundStatus}, ${cancelled.body.refundReference}`);
  const avail2 = await call('GET', `/api/trips/${tripId}/availability`, { token: alice.token });
  check('TC-06d', 'the seat is released', avail2.body.unreserved === 3, `unreserved back to ${avail2.body.unreserved}`);
  const again = await call('POST', `/api/bookings/${booked.body.id}/cancel`, { token: alice.token });
  const avail3 = await call('GET', `/api/trips/${tripId}/availability`, { token: alice.token });
  check('TC-06e', 'cancelling twice is a 409 and releases no second seat',
    again.status === 409 && again.body.code === 'ALREADY_CANCELLED' && avail3.body.unreserved === 3,
    `-> ${again.status} ${again.body.code}; unreserved ${avail3.body.unreserved} (capacity 3)`);
  const rebook = await call('POST', '/api/bookings', { token: bob.token, key: `st-rebook-${RUN}`, body: { tripId } });
  check('TC-06f', 'the released seat can be booked by someone else', rebook.status === 201, `-> ${rebook.status}, seat ${rebook.body.seat_number}`);

  // ---- SEC-01: access control ---------------------------------------------------------------
  const anon = await call('GET', '/api/bookings');
  const passengerAdmin = await call('GET', '/api/admin/trips', { token: alice.token });
  check('SEC-01', 'no token is 401; a passenger on an administrator route is 403',
    anon.status === 401 && passengerAdmin.status === 403, `anonymous -> ${anon.status}; passenger on /api/admin -> ${passengerAdmin.status}`);

  // ---- NFR-03: the last seat under a real race ----------------------------------------------
  const raceTripRes = await call('POST', '/api/admin/trips', {
    token: adminToken,
    body: { train_number: `RC-${RUN}`, origin, destination, departure_utc: iso(4), arrival_utc: iso(4.25), fare: 500, capacity: 1 },
  });
  const raceTrip = raceTripRes.body.id;
  const racers = await Promise.all(Array.from({ length: 8 }, (_, i) => newPassenger(`racer${i}`)));
  const results = await Promise.all(racers.map((r, i) =>
    call('POST', '/api/bookings', { token: r.token, key: `race-${RUN}-${i}`, body: { tripId: raceTrip } })));
  const wins = results.filter((r) => r.status === 201).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  const raceAvail = await call('GET', `/api/trips/${raceTrip}/availability`, { token: adminToken });
  check('NFR-03', '8 passengers race for the last seat: exactly one wins, the rest get 409, availability is 0',
    wins === 1 && conflicts === 7 && raceAvail.body.unreserved === 0,
    `201 x${wins}, 409 x${conflicts}, other x${8 - wins - conflicts}; unreserved ${raceAvail.body.unreserved}`);

  // Clean up so repeated runs leave the timetable as it was.
  await call('DELETE', `/api/admin/trips/${tripId}`, { token: adminToken });
  await call('DELETE', `/api/admin/trips/${raceTrip}`, { token: adminToken });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
