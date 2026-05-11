'use strict';
const { normalize } = require('../src/services/leadNormalizer');

const payloads = [
  {
    label: '#1 Newsletter - jeniveve25',
    data: {"eventName":"leads","companyId":"39b6f166-acce-46af-a426-1ab2fe9641fd","data":{"leadId":"d504d1d0-5bd5-4a38-a483-f7a816aa8723","leadEmail":"jeniveve25@hotmail.com","leadFirstName":null,"leadLastName":null,"leadPhoneNumber":"","leadSource":"NEWSLETTER_SIGNUP","leadOrigin":"NEWSLETTER_SIGNUP","activityAction":"NEWSLETTER_SIGNUP","activityMessage":"","activityListingAddress":"","activityListingStreetAddress":"","activityListingCity":"","activityListingState":"","activityListingZip":"","activitySourceUrl":"https://marquisfarwellhomes.com/blog/eco-luxury-homes","leadTags":[],"companyName":"Marquis Farwell Homes","properties":{}}}
  },
  {
    label: '#2 HOME_VALUE - Rosalee Regalado',
    data: {"eventName":"leads","companyId":"39b6f166-acce-46af-a426-1ab2fe9641fd","data":{"leadId":"a1f0793d-9c14-43fa-aefe-e0f96a9648c8","leadEmail":"onerose562@gmail.com","leadFirstName":"Rosalee","leadLastName":"Regalado","leadPhoneNumber":"(707) 256-9681","leadSource":"HOME_VALUE","leadOrigin":"HOME_VALUE","activityAction":"HOME_VALUE","activityMessage":"User entered address:\n1721 F Street, napa ,ca 94559","activityListingAddress":"","activityListingStreetAddress":"","activityListingCity":"","activityListingState":"","activityListingZip":"","activitySourceUrl":"https://marquisfarwellhomes.com/home-valuation","leadTags":[{"tagId":"1f649d97-cfc7-4e74-81cc-88fd5a41440d","value":"Seller"}],"leadState":"CA","companyName":"Marquis Farwell Homes","properties":{}}}
  },
  {
    label: '#3 CONTACT_INQUIRY - test lead 943 Fallsgrove',
    data: {"eventName":"leads","companyId":"39b6f166-acce-46af-a426-1ab2fe9641fd","data":{"leadId":"00c0344d-dd77-4dc7-a1b2-57bd3bcfb3f5","leadEmail":"test@gmail.com","leadFirstName":"test","leadLastName":"test","leadPhoneNumber":"(802) 613-0729","leadSource":"HOME_SEARCH","leadOrigin":"CONTACT_INQUIRY","activityAction":"CONTACT_INQUIRY","activityMessage":"Hello, I'm interested in an in person tour of the property located at 943 Fallsgrove Way on May 9, 2026 between 10am to 12pm.","activityListingAddress":"943 Fallsgrove Way","activityListingStreetAddress":"943 Fallsgrove Way","activityListingCity":"Vacaville","activityListingState":"CA","activityListingZip":"95687","activityListingPrice":799888,"activitySourceUrl":"https://marquisfarwellhomes.com/home-search/listings/2563748332718420032","leadTags":[],"companyName":"Marquis Farwell Homes","properties":{}}}
  },
];

payloads.forEach(({ label, data }) => {
  const result = normalize(data);
  console.log(`\n${label}`);
  console.log('  email:    ', result.email || '(MISSING)');
  console.log('  name:     ', result.full_name || '(none)');
  console.log('  phone:    ', result.phone || '(none)');
  console.log('  lead_type:', result.lead_type);
  console.log('  property: ', result.property_address || '(none)');
  console.log('  message:  ', (result.message || '').slice(0, 80));
  console.log('  source:   ', result.source);
});
