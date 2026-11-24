// Search page (FR-03 search, FR-04 availability, FR-05 booking) against a fake API.
import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Search from '../pages/Search.jsx';
import { fakeApi } from './fakeApi.js';

// Departure times are built in local time so the time-of-day filter is predictable.
function at(daysAhead, hour) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const TRIPS = [
  { id: 1, train_number: '11111', origin: 'Bengaluru', destination: 'Chennai', departure_utc: at(1, 8), arrival_utc: at(1, 14), fare: '650.00', capacity: 5 },
  { id: 2, train_number: '22222', origin: 'Bengaluru', destination: 'Chennai', departure_utc: at(1, 20), arrival_utc: at(1, 23), fare: '480.00', capacity: 40 },
  { id: 3, train_number: '33333', origin: 'Bengaluru', destination: 'Chennai', departure_utc: at(1, 6), arrival_utc: at(1, 11), fare: '900.00', capacity: 2 },
];
const SEATS = { 1: 4, 2: 30, 3: 0 };

function api(extra = {}) {
  return fakeApi({
    'GET /trips?': () => [200, TRIPS],
    'GET /trips/': (req) => {
      const id = Number(req.path.split('/')[2]);
      return [200, { tripId: id, capacity: 5, unreserved: SEATS[id], enabled: true }];
    },
    ...extra,
  });
}

function renderSearch() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Search />
    </MemoryRouter>
  );
}

async function search() {
  await userEvent.type(screen.getByLabelText('Origin'), 'Bengaluru');
  await userEvent.type(screen.getByLabelText('Destination'), 'Chennai');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByRole('heading', { name: '3 journeys' });
}

const trainOrder = () =>
  screen.getAllByRole('button', { name: /^(Book|Sold out) train/ }).map((b) => b.getAttribute('aria-label').match(/train (\S+)/)[1]);

describe('search', () => {
  test('starts with an empty state and popular routes, not results', () => {
    api();
    renderSearch();

    expect(screen.getByText(/No trips to show/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bengaluru → Chennai' })).toBeInTheDocument();
  });

  test('sends origin, destination and date and lists the journeys by departure time (FR-03)', async () => {
    const calls = api();
    renderSearch();

    await search();

    const query = calls.find((c) => c.path.startsWith('/trips?'));
    expect(query.path).toMatch(/origin=Bengaluru&destination=Chennai&date=\d{4}-\d{2}-\d{2}/);
    expect(trainOrder()).toEqual(['33333', '11111', '22222']);
  });

  test('shows the seats left for each journey and disables a sold-out one (FR-04)', async () => {
    api();
    renderSearch();
    await search();

    expect(await screen.findByText('4 seats left')).toBeInTheDocument();
    expect(screen.getByText('30 seats left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sold out train 33333/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Book train 22222/ })).toBeEnabled();
  });

  test('the swap button exchanges origin and destination', async () => {
    api();
    renderSearch();
    await userEvent.type(screen.getByLabelText('Origin'), 'Bengaluru');
    await userEvent.type(screen.getByLabelText('Destination'), 'Chennai');

    await userEvent.click(screen.getByRole('button', { name: 'Swap origin and destination' }));

    expect(screen.getByLabelText('Origin')).toHaveValue('Chennai');
    expect(screen.getByLabelText('Destination')).toHaveValue('Bengaluru');
  });
});

describe('filters and sorting', () => {
  test('sort by lowest fare and by most seats', async () => {
    api();
    renderSearch();
    await search();
    await screen.findByText('4 seats left');

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'fare');
    expect(trainOrder()).toEqual(['22222', '11111', '33333']);

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'seats');
    expect(trainOrder()).toEqual(['22222', '11111', '33333']);
  });

  test('"Only trains with seats" hides the sold-out journey, and Clear all brings it back', async () => {
    api();
    renderSearch();
    await search();
    await screen.findByText('4 seats left');

    await userEvent.click(screen.getByLabelText('Only trains with seats'));
    expect(screen.getByRole('heading', { name: '2 journeys' })).toBeInTheDocument();
    expect(trainOrder()).not.toContain('33333');

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('heading', { name: '3 journeys' })).toBeInTheDocument();
  });

  test('the departure-time filter keeps only the chosen part of the day', async () => {
    api();
    renderSearch();
    await search();

    await userEvent.click(screen.getByLabelText('Evening (18:00 – 24:00)'));

    expect(screen.getByRole('heading', { name: '1 journey' })).toBeInTheDocument();
    expect(trainOrder()).toEqual(['22222']);
  });

  test('the fare slider hides journeys above the chosen maximum', async () => {
    api();
    renderSearch();
    await search();

    fireEvent.change(screen.getByLabelText('Maximum fare'), { target: { value: '700' } });

    expect(screen.getByRole('heading', { name: '2 journeys' })).toBeInTheDocument();
    expect(trainOrder()).not.toContain('33333'); // 900.00
    expect(screen.getByText('Up to ₹700.00')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Maximum fare'), { target: { value: '900' } }); // back to the top
    expect(screen.getByRole('heading', { name: '3 journeys' })).toBeInTheDocument();
  });

  test('a filter that matches nothing explains why and offers to clear', async () => {
    api();
    renderSearch();
    await search();

    await userEvent.click(screen.getByLabelText('Afternoon (12:00 – 18:00)'));

    expect(screen.getByText('No journeys match your filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('heading', { name: '3 journeys' })).toBeInTheDocument();
  });

  test('marks the cheapest journey as Best price', async () => {
    api();
    renderSearch();
    await search();

    const best = screen.getByText('Best price').closest('li');
    expect(within(best).getByText('22222')).toBeInTheDocument();
  });
});

describe('date strip', () => {
  test('shows the lowest fare for nearby days and searches again when a day is picked', async () => {
    const calls = api();
    renderSearch();
    await search();

    const strip = await screen.findByRole('group', { name: 'Nearby dates and lowest fares' });
    const days = await within(strip).findAllByRole('button');
    expect(days).toHaveLength(7);
    expect(within(strip).getAllByText('₹480.00').length).toBeGreaterThan(0); // the cheapest trip
    const current = days.find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(current).toBeDefined();

    const other = days.find((b) => b.getAttribute('aria-pressed') === 'false');
    const before = calls.length;
    await userEvent.click(other);

    const searchedAgain = calls.slice(before).find((c) => c.path.startsWith('/trips?'));
    expect(searchedAgain).toBeDefined();
    expect(await within(strip).findAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  test('a popular route chip fills the form and searches', async () => {
    const calls = api();
    renderSearch();

    await userEvent.click(screen.getByRole('button', { name: 'Bengaluru → Chennai' }));

    expect(await screen.findByRole('heading', { name: '3 journeys' })).toBeInTheDocument();
    expect(screen.getByLabelText('Origin')).toHaveValue('Bengaluru');
    expect(calls.find((c) => c.path.startsWith('/trips?')).path).toMatch(/origin=Bengaluru&destination=Chennai/);
  });

  test('a failed search shows the server message', async () => {
    fakeApi({ 'GET /trips?': () => [400, { code: 'VALIDATION_ERROR', message: 'origin, destination and date are all required.' }] });
    renderSearch();

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('origin, destination and date are all required.');
  });
});

describe('booking from the results (FR-05)', () => {
  test('Book sends the trip id with a fresh Idempotency-Key and shows the PNR', async () => {
    const calls = api({
      'POST /bookings': () => [201, { id: 9, pnr: 'ZZZZ9999', seat_number: 1, train_number: '22222', status: 'confirmed' }],
    });
    renderSearch();
    await search();

    await userEvent.click(await screen.findByRole('button', { name: /^Book train 22222/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Booked. PNR ZZZZ9999, seat 1 on train 22222.');
    expect(screen.getByRole('link', { name: 'View in My bookings' })).toHaveAttribute('href', '/my-bookings');
    const post = calls.find((c) => c.method === 'POST');
    expect(post.body).toEqual({ tripId: 2 });
    expect(post.headers['Idempotency-Key']).toMatch(/^2-\d+-[a-z0-9]+$/);
  });

  test('two bookings use two different Idempotency-Keys, so they are not mistaken for a retry', async () => {
    const calls = api({
      'POST /bookings': () => [201, { id: 9, pnr: 'ZZZZ9999', seat_number: 1, train_number: '22222' }],
    });
    renderSearch();
    await search();

    await userEvent.click(await screen.findByRole('button', { name: /^Book train 22222/ }));
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('button', { name: /^Book train 22222/ }));
    await screen.findByRole('status');

    const keys = calls.filter((c) => c.method === 'POST').map((c) => c.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  test('a seat conflict shows the server message and no confirmation', async () => {
    api({
      'POST /bookings': () => [409, { code: 'SEAT_UNAVAILABLE', message: 'No seats available on this trip.' }],
    });
    renderSearch();
    await search();

    await userEvent.click(await screen.findByRole('button', { name: /^Book train 11111/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No seats available on this trip.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
