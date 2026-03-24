import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/mocks/server';
import { render } from '../../../test/utils';
import RealmListPage from '../RealmListPage';

describe('RealmListPage', () => {
  it('shows a loading state initially', () => {
    render(<RealmListPage />, { initialUrl: '/console/realms' });
    expect(screen.getByText(/loading realms/i)).toBeInTheDocument();
  });

  it('renders the list of realms returned from the API', async () => {
    render(<RealmListPage />, { initialUrl: '/console/realms' });

    await screen.findByText('master');
    expect(screen.getByText('test-realm')).toBeInTheDocument();
  });

  it('renders realm display names', async () => {
    render(<RealmListPage />, { initialUrl: '/console/realms' });
    await screen.findByText('Master');
    expect(screen.getByText('Test Realm')).toBeInTheDocument();
  });

  it('shows the "Create Realm" button', async () => {
    render(<RealmListPage />, { initialUrl: '/console/realms' });
    await screen.findByText('master');
    expect(screen.getByRole('button', { name: /create realm/i })).toBeInTheDocument();
  });

  it('shows the "Import Realm" button', async () => {
    render(<RealmListPage />, { initialUrl: '/console/realms' });
    await screen.findByText('master');
    expect(screen.getByRole('button', { name: /import realm/i })).toBeInTheDocument();
  });

  it('shows an error state when the API fails', async () => {
    server.use(
      http.get('/admin/realms', () => {
        return HttpResponse.json({ message: 'Server error' }, { status: 500 });
      }),
    );

    render(<RealmListPage />, { initialUrl: '/console/realms' });
    expect(await screen.findByText(/failed to load realms/i)).toBeInTheDocument();
  });

  it('shows the empty state when there are no realms', async () => {
    server.use(
      http.get('/admin/realms', () => HttpResponse.json([])),
    );

    render(<RealmListPage />, { initialUrl: '/console/realms' });
    expect(
      await screen.findByText(/no realms found/i),
    ).toBeInTheDocument();
  });

  it('shows enabled badge for enabled realms', async () => {
    render(<RealmListPage />, { initialUrl: '/console/realms' });
    await screen.findByText('master');
    // Both default realms are enabled – there should be "Yes" badges
    const yesBadges = screen.getAllByText('Yes');
    expect(yesBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the page heading', async () => {
    render(<RealmListPage />, { initialUrl: '/console/realms' });
    await screen.findByText('master');
    expect(screen.getByRole('heading', { name: /realms/i })).toBeInTheDocument();
  });
});
