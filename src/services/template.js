'use strict';

function render(template, data) {
  if (!template) return '';
  return String(template).replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
    const value = lookup(data, key);
    return value == null ? '' : String(value);
  });
}

function lookup(obj, dottedKey) {
  return dottedKey.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

module.exports = { render };
