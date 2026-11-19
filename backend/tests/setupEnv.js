// Keep the suite fast: bcryptjs at the production cost factor (12) is slow, so tests use 4.
// `authService.js` and `migrate.js` read BCRYPT_ROUNDS with a default of 12, so production is
// unchanged; SEC-02 behaviour (salted adaptive hash, no plaintext) is identical.
process.env.BCRYPT_ROUNDS = '4';
