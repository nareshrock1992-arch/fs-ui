/**
 * utils/camelCase.js  —  snake_case → camelCase helpers
 *
 * Used by conferenceHistory.js (and anywhere else PostgreSQL
 * column names need to be aliased to JS-friendly keys).
 */

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

function mapKeysToCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const key of Object.keys(obj)) {
    out[snakeToCamel(key)] = obj[key];
  }
  return out;
}

module.exports = { snakeToCamel, mapKeysToCamel };
