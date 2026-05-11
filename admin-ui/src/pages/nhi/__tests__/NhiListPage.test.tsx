import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/mocks/server';
import { render } from '../../../test/utils';
import NhiListPage from '../NhiListPage';

function renderNhiList(realm = 'test-realm') {
  return render(<NhiListPage />, {
    initialUrl: `/console/realms/${realm}/nhi`,
    routePattern: '/console/realms/:name/nhi',
  });
}

describe('NhiListPage', () => {
  it('shows a loading state initially', () => {
    renderNhiList();
    expect(screen.getByText(/loading non-human identities/i)).toBeInTheDocument();
  });

  it('renders identity rows after data loads', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    expect(screen.getByText('ai-assistant-01')).toBeInTheDocument();
  });

  it('renders identity names', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    expect(screen.getByText('ai-assistant-01')).toBeInTheDocument();
  });

  it('shows the page heading', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    expect(screen.getByRole('heading', { name: /non-human identities/i })).toBeInTheDocument();
  });

  it('shows the realm name in the subtitle', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    expect(screen.getByText(/test-realm/)).toBeInTheDocument();
  });

  it('renders the Create Identity button', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    expect(screen.getByRole('button', { name: /create identity/i })).toBeInTheDocument();
  });

  it('shows identity type badges', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    expect(screen.getByText('IOT DEVICE')).toBeInTheDocument();
    expect(screen.getByText('AI AGENT')).toBeInTheDocument();
  });

  it('shows lifecycle status badges', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('PROVISIONING')).toBeInTheDocument();
  });

  it('shows enabled badge for enabled identities', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    const yesBadges = screen.getAllByText('Yes');
    expect(yesBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows certificate status when present', async () => {
    renderNhiList();
    await screen.findByText('sensor-gateway-01');
    // Both test identities have certificate fingerprints, so "Active" appears twice
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBe(2);
  });

  it('shows empty-state when there are no identities', async () => {
    server.use(
      http.get('/admin/realms/:name/nhi', () => HttpResponse.json([])),
    );
    renderNhiList();
    expect(await screen.findByText(/no non-human identities found/i)).toBeInTheDocument();
  });

  it('shows an error state when the API fails', async () => {
    server.use(
      http.get('/admin/realms/:name/nhi', () =>
        HttpResponse.json({ message: 'error' }, { status: 500 }),
      ),
    );
    renderNhiList();
    expect(await screen.findByText(/failed to load non-human identities/i)).toBeInTheDocument();
  });
});