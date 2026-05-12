'use strict';
require('dotenv').config();
const { query } = require('../src/db');
query('DELETE FROM messages WHERE id = 30')
  .then(() => { console.log('deleted msg 30'); process.exit(); })
  .catch(e => { console.error(e.message); process.exit(1); });
