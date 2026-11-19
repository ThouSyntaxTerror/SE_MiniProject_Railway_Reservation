// Keep the suite fast: bcryptjs at 12 rounds is correct for production but slow in tests.
// SEC-02 behaviour (salted hash, no plaintext) is unchanged; only the cost factor is lowered.
process.env.BCRYPT_ROUNDS = '4';
