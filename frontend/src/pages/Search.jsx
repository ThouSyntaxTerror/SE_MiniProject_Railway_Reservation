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
          <path d="M0 80h320" stroke="currentColor" strokeWidth="2" opacity=".4" />
          <path className="track" d="M0 86h320" stroke="currentColor" strokeWidth="3" strokeDasharray="8 10" opacity=".35" />
          <g className="train">
            <rect x="40" y="24" width="68" height="42" rx="10" fill="currentColor" />
            <rect x="82" y="32" width="18" height="14" rx="3" fill="#1d4ed8" />
            <rect x="112" y="30" width="58" height="36" rx="7" fill="currentColor" opacity=".75" />
            <rect x="176" y="30" width="58" height="36" rx="7" fill="currentColor" opacity=".55" />
            <rect x="240" y="30" width="58" height="36" rx="7" fill="currentColor" opacity=".4" />
            <rect x="120" y="38" width="12" height="10" rx="2" fill="#1d4ed8" opacity=".6" />
            <rect x="140" y="38" width="12" height="10" rx="2" fill="#1d4ed8" opacity=".6" />
            <rect x="184" y="38" width="12" height="10" rx="2" fill="#1d4ed8" opacity=".5" />
            <rect x="204" y="38" width="12" height="10" rx="2" fill="#1d4ed8" opacity=".5" />
            <circle cx="62" cy="72" r="6" fill="currentColor" />
            <circle cx="92" cy="72" r="6" fill="currentColor" />
          </g>
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
