const { pool, resetDb } = require('./testDb');
const { seedDemoData } = require('../src/db/migrate');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@rrs.test').toLowerCase();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('demo seed safety (SEC-01, FR-01)', () => {
  test('never promotes an existing passenger that owns the configured admin email', async () => {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Existing Passenger', $1, 'hash', 'passenger')`,
      [ADMIN_EMAIL]
    );

    await seedDemoData();

    const { rows } = await pool.query('SELECT role FROM users WHERE email = $1', [ADMIN_EMAIL]);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('passenger'); // unchanged, not silently elevated
  });

  test('creates the demo admin only when the email is absent', async () => {
    await seedDemoData();
    const { rows } = await pool.query('SELECT role FROM users WHERE email = $1', [ADMIN_EMAIL]);
    expect(rows[0].role).toBe('admin');

    await seedDemoData(); // idempotent: no duplicate account
    const { rows: count } = await pool.query('SELECT count(*)::int AS c FROM users WHERE email = $1', [ADMIN_EMAIL]);
    expect(count[0].c).toBe(1);
  });
});
