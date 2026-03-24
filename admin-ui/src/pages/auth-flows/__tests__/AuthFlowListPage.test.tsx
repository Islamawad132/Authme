import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/mocks/server';
import { render } from '../../../test/utils';
import { makeAuthFlow } from '../../../test/mocks/data';
import AuthFlowListPage from '../AuthFlowListPage';

function renderPage(realm = 'test-realm') {
  return render(<AuthFlowListPage />, {
    initialUrl: `/console/realms/${realm}/auth-flows`,
    routePattern: '/console/realms/:name/auth-flows',
  });
}

describe('AuthFlowListPage', () => {
  it('shows a loading state initially', () => {
    renderPage();
    expect(screen.getByText(/loading authentication flows/i)).toBeInTheDocument();
  });

  it('renders flow rows after data loads', async () => {
    renderPage();
    await screen.findByText('Basic Login');
    expect(screen.getByText('MFA Required')).toBeInTheDocument();
  });

  it('shows the page heading', async () => {
    renderPage();
    await screen.findByText('Basic Login');
    expect(
      screen.getByRole('heading', { name: /authentication flows/i }),
    ).toBeInTheDocument();
  });

  it('shows realm name in the subtitle', async () => {
    renderPage();
    await screen.findByText('Basic Login');
    expect(screen.getByText(/test-realm/)).toBeInTheDocument();
  });

  it('renders the Create Flow button', async () => {
    renderPage();
    await screen.findByText('Basic Login');
    expect(screen.getByRole('button', { name: /create flow/i })).toBeInTheDocument();
  });

  it('shows Default badge for the default flow', async () => {
    renderPage();
    await screen.findByText('Basic Login');
    // There are two elements with text "Default": the table header and the badge span
    const defaults = screen.getAllByText('Default');
    expect(defaults.length).toBeGreaterThanOrEqual(2);
    // The badge span has the green styling
    const badge = defaults.find((el) => el.tagName === 'SPAN');
    expect(badge).toBeInTheDocument();
  });

  it('shows the step count for each flow', async () => {
    renderPage();
    await screen.findByText('Basic Login');
    // Both flows have 1 step each in the mock
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Duplicate and Delete buttons for each flow', async () => {
    renderPage();
    await screen.findByText('Basic Login');
    expect(screen.getAllByRole('button', { name: /duplicate/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no flows exist', async () => {
    server.use(
      http.get('/admin/realms/:name/auth-flows', () => HttpResponse.json([])),
    );
    renderPage();
    expect(
      await screen.findByText(/no authentication flows found/i),
    ).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get('/admin/realms/:name/auth-flows', () =>
        HttpResponse.json({ message: 'error' }, { status: 500 }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText(/failed to load authentication flows/i),
    ).toBeInTheDocument();
  });

  it('shows flow description when present', async () => {
    server.use(
      http.get('/admin/realms/:name/auth-flows', () =>
        HttpResponse.json([
          makeAuthFlow({ id: 'flow-1', name: 'My Flow', description: 'Custom description' }),
        ]),
      ),
    );
    renderPage();
    await screen.findByText('My Flow');
    expect(screen.getByText('Custom description')).toBeInTheDocument();
  });
});
