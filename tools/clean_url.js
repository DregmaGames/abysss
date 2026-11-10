#!/usr/bin/env node
// Strip tracking parameters from a URL (same rules as tools/clean_url.py, same JSON list).
//   node tools/clean_url.js "https://example.com/a?utm_source=x&id=7"   -> https://example.com/a?id=7
//   const { cleanUrl } = require('./tools/clean_url');   // call it before every fetch
'use strict';
const RULES = require('./tracking_params.json');
const NAMES = new Set(RULES.names);
const HOST_ONLY = { s: ['x.com', 'twitter.com'], t: ['x.com', 'twitter.com'], feature: ['youtube.com', 'youtu.be'], pp: ['youtube.com', 'youtu.be'] };
function isTracking(name, host) {
  const n = name.toLowerCase();
  if (HOST_ONLY[n]) return HOST_ONLY[n].some(h => host === h || host.endsWith('.' + h));
  return NAMES.has(n) || RULES.prefixes.some(p => n.startsWith(p));
}
function cleanUrl(url) {
  const u = new URL(String(url).trim()), host = u.hostname.toLowerCase();
  for (const k of [...new Set([...u.searchParams.keys()])]) if (isTracking(k, host)) u.searchParams.delete(k);
  const frag = u.hash.slice(1);
  if (frag.includes('=') && [...new URLSearchParams(frag).keys()].every(k => isTracking(k, host))) u.hash = '';
  return u.toString();
}
module.exports = { cleanUrl };
if (require.main === module) process.argv.slice(2).forEach(a => console.log(cleanUrl(a)));
