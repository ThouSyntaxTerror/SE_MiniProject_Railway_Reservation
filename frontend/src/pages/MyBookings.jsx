import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);

  const [notice, setNotice] = useState(null);

  const load = () =>
    apiFetch('/bookings')
      .then(setBookings)
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(booking) {
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch(`/bookings/${booking.id}/cancel`, { method: 'POST' });
      setNotice(`Booking ${result.pnr} cancelled. Refund reference: ${result.refundReference}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>My bookings</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
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
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.pnr}</td>
                <td>
                  {b.train_number} ({b.origin} → {b.destination})
                </td>
                <td>{b.seat_number}</td>
                <td>{b.fare}</td>
                <td>{b.status}</td>
                <td>
                  {b.status === 'confirmed' && (
                    <button type="button" onClick={() => handleCancel(b)} aria-label={`Cancel booking ${b.pnr}`}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
