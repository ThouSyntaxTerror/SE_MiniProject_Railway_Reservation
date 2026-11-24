// App shell: route guards, role-based navigation and sign-out (SEC-01, SEC-03), plus the sign-in
// and registration pages (FR-01, FR-02). The server enforces access control; these tests check that
// the UI does not offer what the server would refuse, and that it reacts correctly to the answers.
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { getToken, getUser, setToken, setUser } from '../api/client.js';
import { fakeApi } from './fakeApi.js';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const PASSENGER = { id: 1, name: 'Asha Rao', email: 'asha@example.com', role: 'passenger' };
const ADMIN = { id: 2, name: 'RRS Administrator', email: 'admin@rrs.test', role: 'admin' };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={FUTURE}>
      <App />
    </MemoryRouter>
  );
}

function signedInAs(user) {
  setToken('token-' + user.id);
  setUser(user);
}

function quietApi(extra = {}) {
  return fakeApi({
    'GET /bookings': () => [200, []],
    'GET /admin/trips': () => [200, []],
    'GET /admin/audit': () => [200, []],
    ...extra,
  });
}

describe('route guards', () => {
  test.each(['/search', '/my-bookings', '/admin'])('signed out, %s redirects to sign-in', (path) => {
    quietApi();
    renderAt(path);

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('an unknown path goes to search (and so to sign-in when signed out)', () => {
    quietApi();
    renderAt('/no-such-page');

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('a passenger who opens /admin is sent to search, not shown the admin page', () => {
    quietApi();
    signedInAs(PASSENGER);
    renderAt('/admin');

    expect(screen.getByRole('heading', { name: 'Plan your next journey' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administration' })).not.toBeInTheDocument();
  });

  test('an administrator can open /admin', async () => {
    quietApi();
    signedInAs(ADMIN);
    renderAt('/admin');

    expect(await screen.findByRole('heading', { name: 'Administration' })).toBeInTheDocument();
  });
});

describe('navigation by role', () => {
  test('signed out: only Search and Sign in', () => {
    quietApi();
    renderAt('/login');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    expect(nav).toHaveTextContent('Sign in');
    expect(nav).not.toHaveTextContent('My bookings');
    expect(nav).not.toHaveTextContent('Admin');
  });

  test('passenger: My bookings, no Admin link, name shown', () => {
    quietApi();
    signedInAs(PASSENGER);
    renderAt('/search');

    expect(screen.getByRole('link', { name: 'My bookings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
  });

  test('administrator: the Admin link is offered', () => {
    quietApi();
    signedInAs(ADMIN);
    renderAt('/search');

    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  test('the first Tab stop is a skip link to the main content (NFR-05)', async () => {
    quietApi();
    renderAt('/login');

    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });
});

describe('sign-out (SEC-03)', () => {
  test('ends the server session, clears the stored session and returns to sign-in', async () => {
    const calls = quietApi({ 'DELETE /sessions/current': () => [204, null] });
    signedInAs(PASSENGER);
    renderAt('/search');

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/sessions/current')).toBe(true);
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  test('still signs out locally if the server cannot be reached', async () => {
    quietApi({ 'DELETE /sessions/current': () => [500, { message: 'down' }] });
    signedInAs(PASSENGER);
    renderAt('/search');

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});

describe('sign-in page (FR-02, SEC-04)', () => {
  test('a successful sign-in stores the session and opens search with the user in the navigation', async () => {
    const calls = quietApi({
      'POST /sessions': () => [201, { token: 'new-token', user: PASSENGER }],
    });
    renderAt('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correctpassword123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Plan your next journey' })).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(getToken()).toBe('new-token');
    expect(calls.find((c) => c.path === '/sessions').body).toEqual({
      email: 'asha@example.com',
      password: 'correctpassword123',
    });
  });

  test('a wrong password shows the server\'s generic message and stays on sign-in', async () => {
    quietApi({ 'POST /sessions': () => [401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }] });
    renderAt('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  test('a locked account shows the lockout message (SEC-04)', async () => {
    quietApi({
      'POST /sessions': () => [429, { code: 'ACCOUNT_LOCKED', message: 'Too many failed sign-in attempts. Try again in 15 minutes.' }],
    });
    renderAt('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correctpassword123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 15 minutes.');
  });
});

describe('registration page (FR-01)', () => {
  test('sends name, email and password and goes to sign-in on success', async () => {
    const calls = quietApi({ 'POST /register': () => [201, { id: 5, name: 'New Person', email: 'new@example.com' }] });
    renderAt('/register');

    await userEvent.type(screen.getByLabelText('Full name'), 'New Person');
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Password (12+ characters)'), 'longenoughpassword');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/register').body).toEqual({
      name: 'New Person',
      email: 'new@example.com',
      password: 'longenoughpassword',
    });
  });

  test('shows the server\'s reason when registration is refused', async () => {
    quietApi({ 'POST /register': () => [409, { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' }] });
    renderAt('/register');

    await userEvent.type(screen.getByLabelText('Full name'), 'Asha Rao');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password (12+ characters)'), 'longenoughpassword');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
  });
});
