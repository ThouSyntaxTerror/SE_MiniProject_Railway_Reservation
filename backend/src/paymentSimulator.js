// Deterministic payment adapter per architecture doc §2.1 — isolates passenger workflows from
// whatever a real gateway would be, in or out of process. Tests flip `forceFailure` to exercise
// the failure path (FR-05: failed payment releases the hold and creates no confirmed booking).

let forceFailure = false;

function setForceFailure(value) {
  forceFailure = value;
}

function authorize(transactionRef) {
  if (forceFailure) {
    return { status: 'failed', reference: transactionRef };
  }
  return { status: 'success', reference: transactionRef };
}

module.exports = { authorize, setForceFailure };
