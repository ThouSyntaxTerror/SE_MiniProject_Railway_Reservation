// Deterministic payment adapter per architecture doc §2.1 — isolates passenger workflows from
// whatever a real gateway would be, in or out of process. Tests flip `forceFailure` to exercise
// the failure path (FR-05) and can flip `forceRefundFailure` for cancellation visibility (FR-07).

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

function refund(transactionRef) {
  const reference = `REF-${transactionRef}`;
  return { status: forceRefundFailure ? 'failed' : 'success', reference };
}

module.exports = { authorize, refund, setForceFailure, setForceRefundFailure };
