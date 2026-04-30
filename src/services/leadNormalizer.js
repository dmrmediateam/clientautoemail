'use strict';

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function normalize(payload) {
  const p = payload || {};

  const fullName = pick(p, ['name', 'full_name', 'fullName', 'lead_name', 'contact_name']);
  const split = splitName(fullName);

  const first = pick(p, ['first_name', 'firstName', 'fname']) || split.first;
  const last  = pick(p, ['last_name', 'lastName', 'lname']) || split.last;

  return {
    first_name: first,
    last_name: last,
    full_name: fullName || [first, last].filter(Boolean).join(' '),
    email: pick(p, ['email', 'lead_email', 'contact_email', 'emailAddress']),
    phone: pick(p, ['phone', 'phone_number', 'phoneNumber', 'lead_phone', 'mobile']),
    property_address: pick(p, ['property_address', 'property_ref', 'address', 'listing_address', 'property']),
    property_url: pick(p, ['property_url', 'listing_url', 'url', 'property_link']),
    property_price: pick(p, ['property_price', 'price', 'listing_price']),
    message: pick(p, ['message', 'notes', 'inquiry', 'comments', 'body']),
    source: pick(p, ['source', 'lead_source']) || 'Luxury Presence',
    received_at: new Date().toISOString(),
  };
}

module.exports = { normalize };
