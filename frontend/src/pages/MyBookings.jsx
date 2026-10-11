import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/bookings')
      .then(setBookings)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>My bookings</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {bookings.length === 0 && !error && <p>No bookings yet.</p>}
      {bookings.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>PNR</th>
              <th>Train</th>
              <th>Seat</th>
              <th>Fare</th>
              <th>Status</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
