import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    return apiFetch('/bookings')
      .then(setBookings)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCancel(booking) {
    if (!window.confirm(`Cancel PNR ${booking.pnr}? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    setBusyId(booking.id);
    try {
      const result = await apiFetch(`/bookings/${booking.id}/cancel`, { method: 'POST' });
      setNotice(`Booking ${result.pnr} cancelled. Refund reference: ${result.refundReference}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const now = Date.now();

  return (
    <div>
      <h1>My bookings</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}
      {bookings.length === 0 && !error && <p>No bookings yet.</p>}

      {bookings.length > 0 && (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Your bookings</caption>
            <thead>
              <tr>
                <th scope="col">PNR</th>
                <th scope="col">Train</th>
                <th scope="col">Seat</th>
                <th scope="col">Fare</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const future = new Date(booking.departure_utc).getTime() > now;
                const cancellable = booking.status === 'confirmed' && future;
                return (
                  <tr key={booking.id}>
                    <td>{booking.pnr}</td>
                    <td>
                      {booking.train_number} ({booking.origin} → {booking.destination})
                    </td>
                    <td>{booking.seat_number}</td>
                    <td>{booking.fare}</td>
                    <td>
                      {booking.status}
                      {booking.refund_reference && (
                        <span className="subtle"> (refund {booking.refund_reference})</span>
                      )}
                    </td>
                    <td>
                      {cancellable ? (
                        <button type="button" onClick={() => onCancel(booking)} disabled={busyId === booking.id}>
                          {busyId === booking.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
