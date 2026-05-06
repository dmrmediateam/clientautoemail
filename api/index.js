'use strict';

// Vercel serverless entry. Wraps the Express app exported from server.js.
// Each invocation reuses the warm Lambda instance, including the pg Pool.
module.exports = require('../server');
