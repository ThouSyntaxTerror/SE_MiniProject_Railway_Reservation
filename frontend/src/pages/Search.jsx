import { useState } from 'react';
import { apiFetch } from '../api/client.js';

export default function Search() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [trips, setTrips] = useState([]);
  const [availability, setAvailability] = useState({});
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  async function onSearch(e) {
    e.preventDefault();
    setError(null);
    setConfirmation(null);
    try {
      const results = await apiFetch(`/trips?origin=${origin}&destination=${destination}&date=${date}`);
      setTrips(results);
      const entries = await Promise.all(
        results.map(async (trip) => [trip.id, await apiFetch(`/trips/${trip.id}/availability`)])
      );
      setAvailability(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onBook(tripId) {
    setError(null);
    setConfirmation(null);
    try {
      const idempotencyKey = `${tripId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const booking = await apiFetch('/bookings', { method: 'POST', body: { tripId }, idempotencyKey });
      setConfirmation(booking);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Search trains</h1>
      <form onSubmit={onSearch}>
        <label htmlFor="origin">Origin</label>
        <input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} required />
        <label htmlFor="destination">Destination</label>
        <input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} required />
        <label htmlFor="date">Travel date</label>
        <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button type="submit">Search</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {confirmation && (
        <p role="status">
          Booked! PNR <strong>{confirmation.pnr}</strong>, seat {confirmation.seat_number}.
        </p>
      )}
      {trips.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Train</th>
              <th>Departs</th>
              <th>Fare</th>
              <th>Seats left</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id}>
                <td>{trip.train_number}</td>
                <td>{new Date(trip.departure_utc).toLocaleString()}</td>
                <td>{trip.fare}</td>
                <td>{availability[trip.id]?.unreserved ?? '…'}</td>
                <td>
                  <button type="button" onClick={() => onBook(trip.id)}>
                    Book
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
