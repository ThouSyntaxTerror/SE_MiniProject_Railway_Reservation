// FR-09: every security-sensitive action appends one row here. Takes a `db` (pool or an
// in-transaction client) so booking writes and their audit row commit/rollback together.
async function record(db, { actorId, action, outcome, requestId }) {
  await db.query(
    'INSERT INTO audit_events (actor_id, action, outcome, request_id) VALUES ($1, $2, $3, $4)',
    [actorId ?? null, action, outcome, requestId ?? null]
  );
}

module.exports = { record };
