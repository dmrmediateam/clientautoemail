'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');

let pool = null;

function getPool() {
  if (pool) return pool;
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
  }
  pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    max: config.database.max,
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error:', err);
  });
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function initDb() {
  const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await getPool().query(sql);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, initDb, close };
