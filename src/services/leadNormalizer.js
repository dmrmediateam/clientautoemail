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

// Luxury Presence wraps everything inside a `data` key.
// Flatten it so the rest of the normalizer works on a single-level object.
function flattenLPPayload(raw) {
  if (!raw || typeof raw !== 'object') return raw || {};
  // LP format: { eventName, companyId, data: { leadEmail, ... } }
  if (raw.data && typeof raw.data === 'object' && raw.eventName) {
    const d = raw.data;
    // Build a full property address from LP's split fields if available
    const addrParts = [
      d.activityListingStreetAddress || d.activityListingAddress || '',
      d.activityListingCity || '',
      d.activityListingState || '',
      d.activityListingZip || '',
    ].map(s => String(s).trim()).filter(Boolean);
    let builtAddress = addrParts.length ? addrParts.join(', ') : '';

    // For HOME_VALUE leads, LP puts the property address inside activityMessage
    // e.g. "User entered address:\n123 Main St\nGeocoded address:\n123 Main St, City, ST 12345, USA"
    if (!builtAddress && d.activityMessage) {
      const geoMatch = d.activityMessage.match(/Geocoded address:\s*\n?(.+?)(?:\n|$)/i);
      const userMatch = d.activityMessage.match(/User entered address:\s*\n?(.+?)(?:\n|$)/i);
      builtAddress = (geoMatch && geoMatch[1].trim()) || (userMatch && userMatch[1].trim()) || '';
    }

    // LP lead tags array — check for explicit Seller tag
    const tags = Array.isArray(d.leadTags) ? d.leadTags.map(t => String(t.value || '').toLowerCase()) : [];

    return {
      // Standard field aliases so pick() finds them
      email: d.leadEmail || '',
      first_name: d.leadFirstName || '',
      last_name: d.leadLastName || '',
      phone: d.leadPhoneNumber || '',
      message: d.activityMessage || '',
      source: d.leadSource || d.leadOrigin || raw.eventName || 'Luxury Presence',
      source_url: d.activitySourceUrl || '',
      property_address: builtAddress,
      property_price: d.activityListingPrice ? String(d.activityListingPrice) : '',
      // LP-specific type hints passed through for normalizeLeadType
      _lp_tags: tags,
      _lp_lead_source: (d.leadSource || '').toUpperCase(),
      _lp_activity_action: (d.activityAction || '').toUpperCase(),
    };
  }
  return raw;
}

function normalizeLeadType(payload) {
  // 0. LP explicit tags (e.g. { value: "Seller" })
  if (Array.isArray(payload._lp_tags)) {
    if (payload._lp_tags.some(t => t.includes('seller') || t.includes('listing') || t.includes('sell'))) return 'seller';
    if (payload._lp_tags.some(t => t === 'buyer' || t === 'buy' || t === 'renter')) return 'buyer';
  }

  // 1. LP lead source / activity action
  const lpSource = payload._lp_lead_source || '';
  const lpAction = payload._lp_activity_action || '';
  if (lpSource === 'HOME_VALUE' || lpAction === 'HOME_VALUE') return 'seller';
  if (lpSource === 'NEWSLETTER_SIGNUP' || lpAction === 'NEWSLETTER_SIGNUP') return 'buyer';

  // 2. Explicit field
  const raw = pick(payload, [
    'lead_type', 'leadType', 'inquiry_type', 'inquiryType', 'type', 'contact_type',
  ]).toLowerCase();
  if (raw.includes('seller') || raw.includes('listing') || raw.includes('sell')) return 'seller';
  if (raw === 'buyer' || raw === 'buy' || raw === 'renter') return 'buyer';

  // 3. Source URL pattern
  const sourceUrl = pick(payload, ['source_url', 'page_url', 'source_url', 'url', 'referrer', 'source']).toLowerCase();
  const sellerUrls = ['/sell', '/home-value', '/home-valuation', '/listing-inquiry', '/sellers', '/what-is-my-home-worth', '/list-my', '/list-your'];
  const buyerUrls  = ['/buy', '/listings', '/home-search', '/search', '/properties', '/buyers'];
  if (sellerUrls.some(p => sourceUrl.includes(p))) return 'seller';
  if (buyerUrls.some(p => sourceUrl.includes(p))) return 'buyer';

  // 4. Keyword scan of message text
  const msg = pick(payload, ['message', 'notes', 'inquiry', 'comments', 'body']).toLowerCase();
  const sellerKeywords = [
    'sell', 'selling', 'list my', 'listing my', 'put my home', 'put my house',
    'market analysis', 'home worth', 'house worth', 'property worth', 'home value',
    'house value', 'property value', 'valuation', 'what would my', 'cash offer',
    'thinking of selling', 'want to sell', 'looking to sell', 'need to sell',
  ];
  if (sellerKeywords.some(kw => msg.includes(kw))) return 'seller';

  // Default: buyer
  return 'buyer';
}

function normalize(rawPayload) {
  const p = flattenLPPayload(rawPayload);

  const fullName = pick(p, ['name', 'full_name', 'fullName', 'lead_name', 'contact_name']) ||
    [p.first_name, p.last_name].filter(Boolean).join(' ');
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
    lead_type: normalizeLeadType(p),
    source: pick(p, ['source', 'lead_source']) || 'Luxury Presence',
    received_at: new Date().toISOString(),
  };
}

module.exports = { normalize };
