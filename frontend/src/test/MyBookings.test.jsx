// My bookings page (FR-06 history, FR-07 cancellation) against a fake API.
import { describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyBookings from '../pages/MyBookings.jsx';
import { fakeApi } from './fakeApi.js';

const CONFIRMED = {
  id: 1, pnr: 'AAAA1111', status: 'confirmed', train_number: '12627',
  origin: 'Bengaluru', destination: 'Chennai', seat_number: 2, fare: '650.00',
};
const CANCELLED = { ...CONFIRMED, id: 2, pnr: 'BBBB2222', status: 'cancelled', seat_number: 3 };

describe('My bookings', () => {
  test('shows an empty state when there are no bookings', async () => {
    fakeApi({ 'GET /bookings': () => [200, []] });
    render(<MyBookings />);

    expect(await screen.findByText('No bookings yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('lists each booking with PNR, route, seat, fare and status', async () => {
    fakeApi({ 'GET /bookings': () => [200, [CONFIRMED, CANCELLED]] });
    render(<MyBookings />);

    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    const first = within(rows[1]);
    expect(first.getByText('AAAA1111')).toBeInTheDocument();
    expect(first.getByText('12627 (Bengaluru → Chennai)')).toBeInTheDocument();
    expect(first.getByText('650.00')).toBeInTheDocument();
    expect(first.getByText('confirmed')).toHaveClass('badge', 'badge-confirmed');
    expect(within(rows[2]).getByText('cancelled')).toHaveClass('badge-cancelled');
  });

  test('offers Cancel only for confirmed bookings, named after the PNR (NFR-05)', async () => {
    fakeApi({ 'GET /bookings': () => [200, [CONFIRMED, CANCELLED]] });
    render(<MyBookings />);

    expect(await screen.findByRole('button', { name: 'Cancel booking AAAA1111' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking BBBB2222' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  test('cancelling posts to the right booking, shows the refund reference and reloads the list', async () => {
    let cancelled = false;
    const calls = fakeApi({
      'GET /bookings': () => [200, [cancelled ? { ...CONFIRMED, status: 'cancelled' } : CONFIRMED]],
      'POST /bookings/1/cancel': () => {
        cancelled = true;
        return [200, { id: 1, pnr: 'AAAA1111', status: 'cancelled', refundStatus: 'success', refundReference: 'RFND-AAAA1111' }];
      },
    });
    render(<MyBookings />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel booking AAAA1111' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Booking AAAA1111 cancelled. Refund reference: RFND-AAAA1111'
    );
    expect(await screen.findByText('cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel booking/ })).not.toBeInTheDocument();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /bookings',
      'POST /bookings/1/cancel',
      'GET /bookings',
    ]);
  });

  test('a rejected cancellation shows the server message and keeps the booking', async () => {
    fakeApi({
      'GET /bookings': () => [200, [CONFIRMED]],
      'POST /bookings/1/cancel': () => [409, { code: 'CANCELLATION_TOO_LATE', message: 'The train has already departed; cancellation is not allowed.' }],
    });
    render(<MyBookings />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel booking AAAA1111' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The train has already departed');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
  });

  test('a failure to load the list is shown instead of an empty state', async () => {
    fakeApi({ 'GET /bookings': () => [500, { code: 'INTERNAL_ERROR', message: 'Unexpected error.' }] });
    render(<MyBookings />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected error.');
    expect(screen.queryByText('No bookings yet.')).not.toBeInTheDocument();
  });
});
