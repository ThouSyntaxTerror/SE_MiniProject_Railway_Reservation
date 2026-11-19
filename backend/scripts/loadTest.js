// NFR-01 / NFR-02 measurement. No external load tool: Node's http client at a fixed
// concurrency of 50, reporting p95. Run the API first (`npm run dev`), then:
//   npm run test:load -- --base http://localhost:3000 --searches 200 --bookings 100
require('dotenv').config();

const http = require('http');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const BASE = new URL(args.base || 'http://localhost:3000');
const SEARCHES = Number(args.searches || 200);
const BOOKINGS = Number(args.bookings || 100);
const USERS = 50;

function request(method, path, { token, body, idempotencyKey } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: BASE.hostname,
        port: BASE.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const started = Date.now();
let seq = 0;

async function poolMap(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      const t0 = process.hrtime.bigint();
      results[index] = await fn(index);
      results[index].ms = Number(process.hrtime.bigint() - t0) / 1e6;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

async function main() {
  const login = await request('POST', '/api/sessions', {
    body: { email: 'passenger@rrs.test', password: 'PassengerPass123' },
  });
  if (login.status !== 200) {
    throw new Error(`Seed the DB and start the API first (login ${login.status}).`);
  }
  const token = login.body.token;

  const searchResults = await poolMap(Array.from({ length: SEARCHES }), 50, async () => {
    const g = 1 + (seq++ % 9000);
    return request(
      'GET',
      `/api/trips?origin=${encodeURIComponent(['Bengaluru','Chennai','Mumbai','Delhi','Pune'][g % 5])}` +
        `&destination=${encodeURIComponent(['Chennai','Bengaluru','Delhi','Mumbai','Pune'][(g + 1) % 5])}` +
        `&date=${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}`
    );
  });

  const okSearches = searchResults.filter((r) => r.status === 200);
  console.log(`NFR-01 search: ${SEARCHES} requests, concurrency 50, 200 OK=${okSearches.length}`);
  console.log(`  p95 = ${p95(okSearches.map((r) => r.ms)).toFixed(1)} ms (target <= 2000 ms)`);

  // NFR-02 needs a trip with enough seats: create one as admin.
  const admin = await request('POST', '/api/sessions', {
    body: {
      email: process.env.ADMIN_EMAIL || 'admin@rrs.test',
      password: process.env.ADMIN_PASSWORD || 'AdminPassword123',
    },
  });
  const departure = new Date(Date.now() + 7 * 86400000).toISOString();
  const trip = await request('POST', '/api/admin/trips', {
    token: admin.body.token,
    body: {
      train_number: `LOAD-${Date.now()}`,
      origin: 'Bengaluru',
      destination: 'Chennai',
      departure_utc: departure,
      arrival_utc: new Date(Date.now() + 7 * 86400000 + 21600000).toISOString(),
      fare: 500,
      capacity: BOOKINGS + 5,
    },
  });
  if (trip.status !== 201) {
    throw new Error(`Could not create load-test trip (${trip.status}): ${JSON.stringify(trip.body)}`);
  }

  const bookingResults = await poolMap(Array.from({ length: BOOKINGS }), 50, async (index) =>
    request('POST', '/api/bookings', {
      token,
      idempotencyKey: `load-${index}-${Date.now()}`,
      body: { tripId: trip.body.id },
    })
  );

  const okBookings = bookingResults.filter((r) => r.status === 201);
  console.log(`NFR-02 booking: ${BOOKINGS} requests, concurrency 50, 201 OK=${okBookings.length}`);
  console.log(`  p95 = ${p95(okBookings.map((r) => r.ms)).toFixed(1)} ms (target <= 3000 ms)`);
  console.log(`  total wall time: ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
