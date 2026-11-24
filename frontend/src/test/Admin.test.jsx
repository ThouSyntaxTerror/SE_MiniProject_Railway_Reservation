// Administration page (FR-08 trip and capacity management, FR-09 audit view) against a fake API.
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Admin from '../pages/Admin.jsx';
import { formatDateTime } from '../time.js';
import { fakeApi } from './fakeApi.js';

const TRIPS = [
  { id: 1, train_number: '12627', origin: 'Bengaluru', destination: 'Chennai', departure_utc: '2026-12-01T03:30:00.000Z', arrival_utc: '2026-12-01T09:30:00.000Z', fare: '650.00', capacity: 5, enabled: true },
  { id: 2, train_number: '12007', origin: 'Bengaluru', destination: 'Chennai', departure_utc: '2026-12-02T03:30:00.000Z', arrival_utc: '2026-12-02T08:30:00.000Z', fare: '480.00', capacity: 40, enabled: false },
];
const AUDIT = [
  { id: 10, actor_email: 'admin@rrs.test', action: 'admin_trip_create', outcome: 'success', created_utc: '2026-11-24T06:00:00.000Z' },
  { id: 9, actor_email: null, action: 'login', outcome: 'failure', created_utc: '2026-11-24T05:59:00.000Z' },
];

function api(extra = {}) {
  return fakeApi({
    'GET /admin/trips': () => [200, TRIPS],
    'GET /admin/audit': () => [200, AUDIT],
    ...extra,
  });
}

const tripRow = async (train) => (await screen.findByText(train)).closest('tr');

describe('administration page', () => {
  test('lists every trip, including disabled ones, and the recent audit events', async () => {
    const calls = api();
    render(<Admin />);

    const row = within(await tripRow('12627'));
    expect(row.getByText('Bengaluru → Chennai')).toBeInTheDocument();
    expect(row.getByLabelText('Capacity for 12627')).toHaveValue(5);
    expect(row.getByText('Yes')).toBeInTheDocument();
    expect(within(await tripRow('12007')).getByText('No')).toBeInTheDocument();

    expect(screen.getByText('admin_trip_create')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // an audit row with no actor
    expect(calls.find((c) => c.path.startsWith('/admin/audit')).path).toBe('/admin/audit?limit=25');
  });

  test('departure and audit times carry a timezone label (SRS §2.4)', async () => {
    api();
    render(<Admin />);

    expect(within(await tripRow('12627')).getByText(formatDateTime(TRIPS[0].departure_utc))).toBeInTheDocument();
    expect(screen.getByText(formatDateTime(AUDIT[0].created_utc))).toBeInTheDocument();
  });

  test('the create form says every field is required and names the time zone (SRS §2.4, §3.1)', async () => {
    api();
    render(<Admin />);
    await tripRow('12627');

    expect(screen.getByText(/^All fields are required\. Times are in your local time zone \(.+\)\.$/)).toBeInTheDocument();
  });

  test('a disabled trip cannot be disabled again', async () => {
    api();
    render(<Admin />);

    const disabledRow = within(await tripRow('12007'));
    expect(disabledRow.getByRole('button', { name: /Disable/ })).toBeDisabled();
    expect(within(await tripRow('12627')).getByRole('button', { name: /Disable/ })).toBeEnabled();
  });

  test('creating a trip sends numbers and UTC times, shows a notice and clears the form', async () => {
    const calls = api({ 'POST /admin/trips': () => [201, { id: 3 }] });
    render(<Admin />);
    await tripRow('12627');

    await userEvent.type(screen.getByLabelText('Train number'), '16021');
    await userEvent.type(screen.getByLabelText('Origin'), 'Mysuru');
    await userEvent.type(screen.getByLabelText('Destination'), 'Chennai');
    fireEvent.change(screen.getByLabelText('Departure (local)'), { target: { value: '2026-12-05T09:30' } });
    fireEvent.change(screen.getByLabelText('Arrival (local)'), { target: { value: '2026-12-05T16:00' } });
    await userEvent.type(screen.getByLabelText('Fare'), '725.5');
    await userEvent.type(screen.getByLabelText('Seat capacity'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Trip 16021 created.');
    expect(calls.find((c) => c.method === 'POST').body).toEqual({
      train_number: '16021',
      origin: 'Mysuru',
      destination: 'Chennai',
      departure_utc: new Date('2026-12-05T09:30').toISOString(),
      arrival_utc: new Date('2026-12-05T16:00').toISOString(),
      fare: 725.5,
      capacity: 12,
    });
    expect(screen.getByLabelText('Train number')).toHaveValue('');
  });

  test('a refused create shows the server reason and keeps what was typed', async () => {
    api({ 'POST /admin/trips': () => [400, { code: 'VALIDATION_ERROR', message: 'arrival_utc must be after departure_utc.' }] });
    render(<Admin />);
    await tripRow('12627');

    await userEvent.type(screen.getByLabelText('Train number'), '16021');
    fireEvent.change(screen.getByLabelText('Departure (local)'), { target: { value: '2026-12-05T09:30' } });
    fireEvent.change(screen.getByLabelText('Arrival (local)'), { target: { value: '2026-12-05T08:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('arrival_utc must be after departure_utc.');
    expect(screen.getByLabelText('Train number')).toHaveValue('16021');
  });

  test('saving a new capacity sends a PATCH for that trip only', async () => {
    const calls = api({ 'PATCH /admin/trips/1': () => [200, { ...TRIPS[0], capacity: 8 }] });
    render(<Admin />);

    const field = within(await tripRow('12627')).getByLabelText('Capacity for 12627');
    await userEvent.clear(field);
    await userEvent.type(field, '8');
    await userEvent.click(within(await tripRow('12627')).getByRole('button', { name: /Save/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Trip 12627 capacity updated.');
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch).toMatchObject({ path: '/admin/trips/1', body: { capacity: 8 } });
  });

  test('a capacity below a confirmed seat is refused with the server message', async () => {
    api({ 'PATCH /admin/trips/1': () => [409, { code: 'CAPACITY_IN_USE', message: 'Cannot shrink capacity below a confirmed seat.' }] });
    render(<Admin />);

    const field = within(await tripRow('12627')).getByLabelText('Capacity for 12627');
    await userEvent.clear(field);
    await userEvent.type(field, '1');
    await userEvent.click(within(await tripRow('12627')).getByRole('button', { name: /Save/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot shrink capacity below a confirmed seat.');
  });

  test('disabling asks for confirmation and sends a DELETE only after OK', async () => {
    const calls = api({ 'DELETE /admin/trips/1': () => [204, null] });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Admin />);

    await userEvent.click(within(await tripRow('12627')).getByRole('button', { name: /Disable/ }));

    expect(confirm).toHaveBeenCalledWith('Disable trip 12627?');
    expect(await screen.findByRole('status')).toHaveTextContent('Trip 12627 disabled.');
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/admin/trips/1')).toBe(true);
  });

  test('choosing Cancel in the confirmation sends nothing', async () => {
    const calls = api();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Admin />);

    await userEvent.click(within(await tripRow('12627')).getByRole('button', { name: /Disable/ }));

    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('a failure to load is shown to the administrator', async () => {
    fakeApi({ 'GET /admin/trips': () => [403, { code: 'FORBIDDEN', message: 'Administrators only.' }], 'GET /admin/audit': () => [200, []] });
    render(<Admin />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Administrators only.');
  });
});
