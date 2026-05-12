'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  const r = await query(`SELECT id, name, agent_name, agent_email FROM clients ORDER BY name`);
  console.table(r.rows.map(c => ({ id: c.id.slice(0,8), name: c.name, agent_name: c.agent_name, email: c.agent_email })));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
