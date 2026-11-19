// Deterministic payment adapter per architecture doc §2.1 — isolates passenger workflows from
// whatever a real gateway would be, in or out of process. Tests flip `forceFailure` to exercise
// the failure path (FR-05: failed payment releases the hold and creates no confirmed booking).

let forceFailure = false;
let forceRefundFailure = false;

function setForceFailure(value) {
  forceFailure = value;
}

function setForceRefundFailure(value) {
  forceRefundFailure = value;
}

function authorize(transactionRef) {
  if (forceFailure) {
    return { status: 'failed', reference: transactionRef };
  }
  return { status: 'success', reference: transactionRef };
}

// FR-07: deterministic simulated refund; the reference is derived from the PNR so it is stable.
function refund(pnr) {
  const reference = `RFND-${pnr}`;
  return { status: forceRefundFailure ? 'failed' : 'success', reference };
}

module.exports = { authorize, refund, setForceFailure, setForceRefundFailure };
