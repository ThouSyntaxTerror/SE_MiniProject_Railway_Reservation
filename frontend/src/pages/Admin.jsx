import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

const EMPTY_TRIP = {
  train_number: '',
  origin: '',
  destination: '',
  departure_utc: '',
  arrival_utc: '',
  fare: '',
  capacity: '',
};

function TripRow({ trip, onSave, onDisable }) {
  const [capacity, setCapacity] = useState(trip.capacity);
  return (
    <tr>
      <td>{trip.train_number}</td>
      <td>{trip.origin} → {trip.destination}</td>
      <td>{new Date(trip.departure_utc).toLocaleString()}</td>
      <td>
        <label className="sr-only" htmlFor={`capacity-${trip.id}`}>Capacity for {trip.train_number}</label>
        <input
          id={`capacity-${trip.id}`}
          type="number"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="inline-number"
        />
        <button type="button" onClick={() => onSave(trip, capacity)}>Save</button>
      </td>
      <td>{trip.enabled ? 'Yes' : 'No'}</td>
      <td>
        <button type="button" onClick={() => onDisable(trip)} disabled={!trip.enabled}>
          Disable
        </button>
      </td>
    </tr>
  );
}

export default function Admin() {
  const [trips, setTrips] = useState([]);
  const [audit, setAudit] = useState([]);
  const [form, setForm] = useState(EMPTY_TRIP);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function load() {
    try {
      const [tripList, auditList] = await Promise.all([
        apiFetch('/admin/trips'),
        apiFetch('/admin/audit?limit=25'),
      ]);
      setTrips(tripList);
      setAudit(auditList);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/admin/trips', {
        method: 'POST',
        body: {
          ...form,
          fare: Number(form.fare),
          capacity: Number(form.capacity),
          departure_utc: new Date(form.departure_utc).toISOString(),
          arrival_utc: new Date(form.arrival_utc).toISOString(),
        },
      });
      setNotice(`Trip ${form.train_number} created.`);
      setForm(EMPTY_TRIP);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onCapacitySave(trip, capacity) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/admin/trips/${trip.id}`, { method: 'PATCH', body: { capacity: Number(capacity) } });
      setNotice(`Trip ${trip.train_number} capacity updated.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDisable(trip) {
    if (!window.confirm(`Disable trip ${trip.train_number}?`)) return;
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/admin/trips/${trip.id}`, { method: 'DELETE' });
      setNotice(`Trip ${trip.train_number} disabled.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Administration</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}

      <section aria-labelledby="create-trip-heading">
        <h2 id="create-trip-heading">Create trip</h2>
        <form onSubmit={onCreate} className="grid-form" noValidate>
          <label htmlFor="train_number">Train number</label>
          <input id="train_number" value={form.train_number} onChange={(e) => update('train_number', e.target.value)} required />

          <label htmlFor="origin">Origin</label>
          <input id="origin" value={form.origin} onChange={(e) => update('origin', e.target.value)} required />

          <label htmlFor="destination">Destination</label>
          <input id="destination" value={form.destination} onChange={(e) => update('destination', e.target.value)} required />

          <label htmlFor="departure">Departure (local)</label>
          <input id="departure" type="datetime-local" value={form.departure_utc} onChange={(e) => update('departure_utc', e.target.value)} required />

          <label htmlFor="arrival">Arrival (local)</label>
          <input id="arrival" type="datetime-local" value={form.arrival_utc} onChange={(e) => update('arrival_utc', e.target.value)} required />

          <label htmlFor="fare">Fare</label>
          <input id="fare" type="number" min="1" step="0.01" value={form.fare} onChange={(e) => update('fare', e.target.value)} required />

          <label htmlFor="capacity">Seat capacity</label>
          <input id="capacity" type="number" min="1" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} required />

          <button type="submit">Create trip</button>
        </form>
      </section>

      <section aria-labelledby="trips-heading">
        <h2 id="trips-heading">Trips</h2>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">All trips</caption>
            <thead>
              <tr>
                <th scope="col">Train</th>
                <th scope="col">Route</th>
                <th scope="col">Departs</th>
                <th scope="col">Capacity</th>
                <th scope="col">Enabled</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <TripRow key={trip.id} trip={trip} onSave={onCapacitySave} onDisable={onDisable} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="audit-heading">
        <h2 id="audit-heading">Recent audit events</h2>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Audit events</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_utc).toLocaleString()}</td>
                  <td>{event.actor_email || '—'}</td>
                  <td>{event.action}</td>
                  <td>{event.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
