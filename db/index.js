const { Pool } = require('pg');

// Heroku Postgres requires SSL, but presents a self-signed cert chain,
// so we disable strict verification. Locally (no DATABASE_URL SSL requirement)
// this flag is harmless.
const useSSL = process.env.DATABASE_URL && process.env.NODE_ENV !== 'test'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : useSSL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
