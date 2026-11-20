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
      <section className="hero">
        <h1>Search trains</h1>
        <p>Pick a route and a date. Confirmed seats, instant refunds on cancellation.</p>
        <svg className="hero-art" viewBox="0 0 320 90" aria-hidden="true" focusable="false">
          <path d="M0 78h320" stroke="currentColor" strokeWidth="2" opacity=".35" />
          <path d="M10 86h300" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" opacity=".25" />
          <rect x="40" y="26" width="64" height="40" rx="8" fill="currentColor" opacity=".9" />
          <rect x="108" y="30" width="60" height="36" rx="6" fill="currentColor" opacity=".7" />
          <rect x="172" y="30" width="60" height="36" rx="6" fill="currentColor" opacity=".55" />
          <rect x="236" y="30" width="60" height="36" rx="6" fill="currentColor" opacity=".4" />
          <circle cx="62" cy="72" r="6" fill="currentColor" />
          <circle cx="90" cy="72" r="6" fill="currentColor" />
        </svg>
      </section>
      <form className="search-card" onSubmit={onSearch} noValidate>
        <div className="field">
          <label htmlFor="origin">Origin</label>
          <input
            id="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Bengaluru"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="destination">Destination</label>
          <input
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Chennai"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="date">Travel date</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
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
                    <td><strong>{trip.train_number}</strong></td>
                    <td>{new Date(trip.departure_utc).toLocaleString()}</td>
                    <td className="fare">{trip.fare}</td>
                    <td>
                      <span className={`seats ${soldOut ? 'seats-out' : seats <= 3 ? 'seats-low' : 'seats-ok'}`}>
                        {seats ?? '…'}
                      </span>
                    </td>
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
      {trips.length === 0 && <p className="empty">No trips to show. Search by origin, destination and date.</p>}
    </div>
  );
}
