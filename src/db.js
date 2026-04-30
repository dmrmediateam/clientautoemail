'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

let db = null;

function getDb() {
  if (db) return db;
  const dir = path.dirname(config.database.path);
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(config.database.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initDb() {
  const conn = getDb();
  const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  conn.exec(sql);
  return conn;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, initDb, close };
