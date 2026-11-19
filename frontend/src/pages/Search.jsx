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
  const [bookingId, setBookingId] = useState(null);

  async function refreshAvailability(results) {
    const entries = await Promise.all(
      results.map(async (trip) => [trip.id, await apiFetch(`/trips/${trip.id}/availability`)])
    );
    setAvailability(Object.fromEntries(entries));
  }

  async function onSearch(e) {
    e.preventDefault();
    setError(null);
    setConfirmation(null);
    try {
      const results = await apiFetch(
        `/trips?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${date}`
      );
      setTrips(results);
      await refreshAvailability(results);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onBook(trip) {
    setError(null);
    setConfirmation(null);
    setBookingId(trip.id);
    try {
      const idempotencyKey = `${trip.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const booking = await apiFetch('/bookings', {
        method: 'POST',
        body: { tripId: trip.id },
        idempotencyKey,
      });
      setConfirmation(booking);
      await refreshAvailability(trips);
    } catch (err) {
      setError(err.message);
      await refreshAvailability(trips).catch(() => {});
    } finally {
      setBookingId(null);
    }
  }

  return (
    <div>
      <h1>Search trains</h1>
      <form onSubmit={onSearch} noValidate>
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
        <p className="success" role="status">
          Booked. PNR <strong>{confirmation.pnr}</strong>, seat {confirmation.seat_number} on train{' '}
          {confirmation.train_number}.
        </p>
      )}

      {trips.length > 0 && (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Trips matching the search</caption>
            <thead>
              <tr>
                <th scope="col">Train</th>
                <th scope="col">Departs</th>
                <th scope="col">Fare</th>
                <th scope="col">Seats left</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => {
                const seats = availability[trip.id]?.unreserved;
                const soldOut = seats === 0;
                return (
                  <tr key={trip.id}>
                    <td>{trip.train_number}</td>
                    <td>{new Date(trip.departure_utc).toLocaleString()}</td>
                    <td>{trip.fare}</td>
                    <td>{seats ?? '…'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onBook(trip)}
                        disabled={soldOut || bookingId === trip.id}
                      >
                        {soldOut ? 'Sold out' : bookingId === trip.id ? 'Booking…' : 'Book'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {trips.length === 0 && <p>No trips to show. Search by origin, destination and date.</p>}
    </div>
  );
}
