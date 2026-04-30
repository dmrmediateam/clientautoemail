'use strict';

const { initDb } = require('../src/db');

initDb();
console.log('[migrate] schema applied. DB ready.');
