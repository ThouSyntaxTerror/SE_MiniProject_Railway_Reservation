import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client.js';

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
};
const fromISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtMoney = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDuration = (a, b) => {
  const mins = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  return `${Math.floor(mins / 60)}h ${pad(mins % 60)}m`;
};

const BUCKETS = [
  { id: 'night', label: 'Night (00:00 – 06:00)', from: 0, to: 6 },
  { id: 'morning', label: 'Morning (06:00 – 12:00)', from: 6, to: 12 },
  { id: 'afternoon', label: 'Afternoon (12:00 – 18:00)', from: 12, to: 18 },
  { id: 'evening', label: 'Evening (18:00 – 24:00)', from: 18, to: 24 },
];
const bucketOf = (iso) => {
  const h = new Date(iso).getHours();
  return BUCKETS.find((b) => h >= b.from && h < b.to).id;
};

const POPULAR = [
  ['Bengaluru', 'Chennai'],
  ['Chennai', 'Bengaluru'],
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".15" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f3f55" />
          <stop offset="0.6" stopColor="#6b8c97" />
          <stop offset="1" stopColor="#e9b27f" />
        </linearGradient>
      </defs>
      <rect width="1200" height="300" fill="url(#sky)" />
      <rect y="240" width="1200" height="60" fill="#2c4d3f" />
      <g transform="translate(0 -45)">
      <circle cx="930" cy="92" r="34" fill="#fbe2b8" opacity=".9" />
      <path d="M0 190 L120 120 L210 170 L340 90 L470 175 L600 110 L740 180 L880 100 L1020 170 L1200 120 V300 H0Z" fill="#587a74" opacity=".85" />
      <path d="M0 225 L90 175 L200 215 L330 160 L470 220 L610 170 L760 225 L900 175 L1060 220 L1200 180 V300 H0Z" fill="#3f6656" />
      <path d="M0 260 Q200 225 400 255 T800 250 T1200 245 V300 H0Z" fill="#2c4d3f" />
      <rect y="262" width="1200" height="4" fill="#1b2e27" opacity=".7" />
      <rect y="272" width="1200" height="2" fill="#1b2e27" opacity=".5" />
      <g className="train">
        <rect x="0" y="228" width="340" height="30" rx="8" fill="#f5f2ec" />
        <rect x="0" y="244" width="340" height="5" fill="#c4512a" />
        <rect x="262" y="222" width="86" height="36" rx="12" fill="#ece6db" />
        <rect x="300" y="230" width="34" height="12" rx="4" fill="#274a5e" />
        {[18, 62, 106, 150, 194, 238].map((x) => (
          <rect key={x} x={x} y="233" width="26" height="9" rx="3" fill="#274a5e" opacity=".85" />
        ))}
      </g>
      </g>
    </svg>
  );
}

export default function Search() {
  const today = toISO(new Date());
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(addDays(today, 1));
  const [searched, setSearched] = useState(null);
  const [trips, setTrips] = useState([]);
  const [availability, setAvailability] = useState({});
  const [strip, setStrip] = useState([]);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [times, setTimes] = useState([]);
  const [onlySeats, setOnlySeats] = useState(false);
  const [maxFare, setMaxFare] = useState(null);
  const [sort, setSort] = useState('depart');

  async function refreshAvailability(results) {
    const entries = await Promise.all(
      results.map(async (trip) => [trip.id, await apiFetch(`/trips/${trip.id}/availability`)])
    );
    setAvailability(Object.fromEntries(entries));
  }

  async function loadStrip(o, d, centre) {
    let start = addDays(centre, -3);
    if (start < today) start = today;
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const entries = await Promise.all(
      days.map(async (day) => {
        try {
          const r = await apiFetch(
            `/trips?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&date=${day}`
          );
          return [day, r.length ? Math.min(...r.map((t) => Number(t.fare))) : null];
        } catch {
          return [day, null];
        }
      })
    );
    setStrip(entries);
  }

  async function runSearch(query = { origin, destination, date }) {
    setError(null);
    setConfirmation(null);
    try {
      const results = await apiFetch(
        `/trips?origin=${encodeURIComponent(query.origin)}&destination=${encodeURIComponent(query.destination)}&date=${query.date}`
      );
      setTrips(results);
      setSearched(query);
      setTimes([]);
      setOnlySeats(false);
      setMaxFare(null);
      await refreshAvailability(results);
      loadStrip(query.origin, query.destination, query.date);
    } catch (err) {
      setError(err.message);
    }
  }

  function onSearch(e) {
    e.preventDefault();
    runSearch();
  }

  function pickDay(day) {
    setDate(day);
    runSearch({ origin: searched.origin, destination: searched.destination, date: day });
  }

  function pickRoute(o, d) {
    setOrigin(o);
    setDestination(d);
    runSearch({ origin: o, destination: d, date });
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

  const bounds = useMemo(() => {
    if (trips.length === 0) return null;
    const fares = trips.map((t) => Number(t.fare));
    return { min: Math.floor(Math.min(...fares)), max: Math.ceil(Math.max(...fares)) };
  }, [trips]);

  const view = useMemo(() => {
    const list = trips.filter((t) => {
      if (times.length && !times.includes(bucketOf(t.departure_utc))) return false;
      if (onlySeats && availability[t.id]?.unreserved === 0) return false;
      if (maxFare != null && Number(t.fare) > maxFare) return false;
      return true;
    });
    const by = {
      depart: (a, b) => new Date(a.departure_utc) - new Date(b.departure_utc),
      fare: (a, b) => Number(a.fare) - Number(b.fare),
      seats: (a, b) => (availability[b.id]?.unreserved ?? 0) - (availability[a.id]?.unreserved ?? 0),
    };
    return [...list].sort(by[sort]);
  }, [trips, times, onlySeats, maxFare, sort, availability]);

  const bestFare = view.length > 1 ? Math.min(...view.map((t) => Number(t.fare))) : null;
  const filtersOn = times.length > 0 || onlySeats || maxFare != null;

  function clearFilters() {
    setTimes([]);
    setOnlySeats(false);
    setMaxFare(null);
  }

  function toggleTime(id) {
    setTimes((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div>
      <section className="hero">
        <HeroArt />
        <div className="hero-text">
          <h1>Plan your next journey</h1>
          <p>Search trains, pick a seat and book in seconds. Cancel any time before departure.</p>
        </div>
      </section>

      <form className="searchbar" onSubmit={onSearch} noValidate role="search" aria-label="Search trains">
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
        <button
          type="button"
          className="swap"
          aria-label="Swap origin and destination"
          onClick={() => {
            setOrigin(destination);
            setDestination(origin);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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
        <button type="submit" className="go">Search</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {confirmation && (
        <p className="success" role="status">
          Booked. PNR <strong>{confirmation.pnr}</strong>, seat {confirmation.seat_number} on train{' '}
          {confirmation.train_number}. <Link to="/my-bookings">View in My bookings</Link>
        </p>
      )}

      {searched && strip.length > 0 && (
        <div className="datestrip" role="group" aria-label="Nearby dates and lowest fares">
          {strip.map(([day, fare]) => (
            <button key={day} type="button" aria-pressed={day === searched.date} onClick={() => pickDay(day)}>
              <span>{fromISO(day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <strong>{fare == null ? 'No trains' : fmtMoney(fare)}</strong>
            </button>
          ))}
        </div>
      )}

      {!searched && (
        <div className="empty">
          <p>No trips to show. Search by origin, destination and date, or try a popular route.</p>
          <div className="routes">
            {POPULAR.map(([o, d]) => (
              <button key={o + d} type="button" className="chip" onClick={() => pickRoute(o, d)}>
                {o} → {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && (
        <div className="results-layout">
          <aside className="panel filters" aria-label="Filters">
            <div className="filters-head">
              <h2>Filters</h2>
              {filtersOn && (
                <button type="button" className="link-btn" onClick={clearFilters}>Clear all</button>
              )}
            </div>
            <fieldset>
              <legend>Departure time</legend>
              {BUCKETS.map((b) => (
                <label key={b.id} className="check">
                  <input type="checkbox" checked={times.includes(b.id)} onChange={() => toggleTime(b.id)} />
                  {b.label}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Availability</legend>
              <label className="check">
                <input type="checkbox" checked={onlySeats} onChange={(e) => setOnlySeats(e.target.checked)} />
                Only trains with seats
              </label>
            </fieldset>
            {bounds && bounds.max > bounds.min && (
              <fieldset>
                <legend>Maximum fare</legend>
                <label htmlFor="maxfare" className="sr-only">Maximum fare</label>
                <input
                  id="maxfare"
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  value={maxFare ?? bounds.max}
                  onChange={(e) => setMaxFare(Number(e.target.value) >= bounds.max ? null : Number(e.target.value))}
                />
                <span className="subtle">Up to {fmtMoney(maxFare ?? bounds.max)}</span>
              </fieldset>
            )}
          </aside>

          <section aria-label="Results">
            <div className="results-head">
              <div aria-live="polite">
                <h2>{view.length} {view.length === 1 ? 'journey' : 'journeys'}</h2>
                <span className="subtle">
                  {searched.origin} → {searched.destination} •{' '}
                  {fromISO(searched.date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="sort">
                <label htmlFor="sort">Sort by</label>
                <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="depart">Earliest departure</option>
                  <option value="fare">Lowest fare</option>
                  <option value="seats">Most seats</option>
                </select>
              </div>
            </div>

            {trips.length === 0 && (
              <p className="empty">No trains on this date. Pick another date above.</p>
            )}
            {trips.length > 0 && view.length === 0 && (
              <div className="empty">
                <p>No journeys match your filters.</p>
                <button type="button" className="chip" onClick={clearFilters}>Clear filters</button>
              </div>
            )}

            <ul className="journeys">
              {view.map((trip) => {
                const seats = availability[trip.id]?.unreserved;
                const soldOut = seats === 0;
                const seatClass = soldOut ? 'seats-out' : seats != null && seats <= 3 ? 'seats-low' : 'seats-ok';
                const isBest = bestFare != null && Number(trip.fare) === bestFare;
                return (
                  <li key={trip.id} className={`journey${isBest ? ' best' : ''}`}>
                    {isBest && <span className="tag">Best price</span>}
                    <div>
                      <div className="times">
                        <span>{fmtTime(trip.departure_utc)}</span>
                        <span className="line" aria-hidden="true" />
                        <span>{fmtTime(trip.arrival_utc)}</span>
                      </div>
                      <div className="route-names">
                        <span>{trip.origin}</span>
                        <span>{trip.destination}</span>
                      </div>
                      <div className="meta">
                        {new Date(trip.departure_utc).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} •{' '}
                        {fmtDuration(trip.departure_utc, trip.arrival_utc)} • Train <strong>{trip.train_number}</strong>
                      </div>
                    </div>
                    <ul className="perks">
                      <li>
                        <span className={`seats ${seatClass}`}>
                          {seats == null ? '…' : soldOut ? 'Sold out' : `${seats} ${seats === 1 ? 'seat' : 'seats'} left`}
                        </span>
                      </li>
                      <li><Check /> Cancel until departure</li>
                      <li><Check /> Instant refund reference</li>
                    </ul>
                    <div className="buy">
                      <div className="price">{fmtMoney(trip.fare)}</div>
                      <p className="subtle">per seat</p>
                      <button
                        type="button"
                        onClick={() => onBook(trip)}
                        disabled={soldOut || bookingId === trip.id}
                        aria-label={`${soldOut ? 'Sold out' : 'Book'} train ${trip.train_number} departing ${fmtTime(trip.departure_utc)}`}
                      >
                        {soldOut ? 'Sold out' : bookingId === trip.id ? 'Booking…' : 'Book'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="side">
            <div className="panel green">
              <h2>Cancel with confidence</h2>
              <p>Change of plans? Cancel from My bookings before departure and the seat is released straight away.</p>
            </div>
            <div className="panel">
              <h2>How booking works</h2>
              <ol>
                <li>Pick a journey and press Book.</li>
                <li>Payment is confirmed instantly.</li>
                <li>Keep your PNR from My bookings.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
