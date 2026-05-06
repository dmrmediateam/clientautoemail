'use strict';

const { initDb, close } = require('../src/db');

(async () => {
  try {
    await initDb();
    console.log('[migrate] schema applied. DB ready.');
  } catch (err) {
    console.error('[migrate] failed:', err);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
