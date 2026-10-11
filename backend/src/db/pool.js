const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://rrs:rrs@localhost:5432/rrs',
});

module.exports = pool;
