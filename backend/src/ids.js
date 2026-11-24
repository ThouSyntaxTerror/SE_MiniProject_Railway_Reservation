// Strict parsing of record ids (trip and booking ids) taken from request bodies and URLs.
//
// `Number(value)` is too forgiving for this: it turns `true`, `[1]`, "1e0", " 1" and "0x1" into 1,
// and accepts integers beyond what the database column can hold, which then fail inside PostgreSQL
// as a 500. Every id in the schema is a SERIAL, i.e. a PostgreSQL INTEGER, so a valid id is a
// positive whole number no larger than 2,147,483,647, given either as a JSON number or as a string
// of plain decimal digits with no sign, spaces, exponent, prefix or leading zero.
const MAX_ID = 2147483647;
const DIGITS = /^[1-9][0-9]{0,9}$/;

// Returns the id as a number, or null when `value` is not a valid id.
function parseId(value) {
  let text;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) return null;
    text = String(value);
  } else if (typeof value === 'string') {
    text = value;
  } else {
    return null; // booleans, arrays, objects, null, undefined
  }
  if (!DIGITS.test(text)) return null;
  const id = Number(text);
  return id <= MAX_ID ? id : null;
}

module.exports = { parseId, MAX_ID };
