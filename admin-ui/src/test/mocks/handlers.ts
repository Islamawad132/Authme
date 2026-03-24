import { http, HttpResponse } from 'msw';
import { makeRealm, makeUser, makeClient } from './data';

const BASE = '/admin';

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { username?: string; password?: string };
    if (body.username === 'admin' && body.password === 'password') {
      return HttpResponse.json({ access_token: 'mock-token-abc123' });
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),

  http.post(`${BASE}/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logged out' });
  }),

  // Realms
  http.get(`${BASE}/realms`, () => {
    return HttpResponse.json([
      makeRealm({ id: 'realm-1', name: 'master', displayName: 'Master' }),
      makeRealm({ id: 'realm-2', name: 'test-realm', displayName: 'Test Realm' }),
    ]);
  }),

  http.get(`${BASE}/realms/:name`, ({ params }) => {
    return HttpResponse.json(
      makeRealm({ name: params.name as string, displayName: String(params.name) }),
    );
  }),

  http.post(`${BASE}/realms`, async ({ request }) => {
    const body = await request.json() as Partial<ReturnType<typeof makeRealm>>;
    return HttpResponse.json(makeRealm({ ...body }), { status: 201 });
  }),

  http.put(`${BASE}/realms/:name`, async ({ params, request }) => {
    const body = await request.json() as Partial<ReturnType<typeof makeRealm>>;
    return HttpResponse.json(makeRealm({ name: params.name as string, ...body }));
  }),

  http.delete(`${BASE}/realms/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Users
  http.get(`${BASE}/realms/:name/users`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const users = [
      makeUser({ id: 'user-1', username: 'alice', email: 'alice@example.com' }),
      makeUser({ id: 'user-2', username: 'bob', email: 'bob@example.com', enabled: false }),
    ];
    const sliced = users.slice((page - 1) * limit, page * limit);
    return HttpResponse.json({ users: sliced, total: users.length });
  }),

  http.get(`${BASE}/realms/:name/users/:id`, ({ params }) => {
    return HttpResponse.json(
      makeUser({ id: params.id as string }),
    );
  }),

  http.post(`${BASE}/realms/:name/users`, async ({ request }) => {
    const body = await request.json() as Partial<ReturnType<typeof makeUser>>;
    return HttpResponse.json(makeUser({ ...body, id: 'new-user-1' }), { status: 201 });
  }),

  http.put(`${BASE}/realms/:name/users/:id`, async ({ params, request }) => {
    const body = await request.json() as Partial<ReturnType<typeof makeUser>>;
    return HttpResponse.json(makeUser({ id: params.id as string, ...body }));
  }),

  http.delete(`${BASE}/realms/:name/users/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Clients
  http.get(`${BASE}/realms/:name/clients`, () => {
    return HttpResponse.json([
      makeClient({ id: 'client-1', clientId: 'my-app', clientType: 'CONFIDENTIAL' }),
      makeClient({ id: 'client-2', clientId: 'public-app', clientType: 'PUBLIC', name: 'Public App' }),
    ]);
  }),

  http.get(`${BASE}/realms/:name/clients/:id`, ({ params }) => {
    return HttpResponse.json(
      makeClient({ clientId: params.id as string }),
    );
  }),

  http.post(`${BASE}/realms/:name/clients`, async ({ request }) => {
    const body = await request.json() as Partial<ReturnType<typeof makeClient>>;
    return HttpResponse.json(
      makeClient({ ...body, id: 'new-client-1', clientSecret: 'super-secret-value' }),
      { status: 201 },
    );
  }),

  http.put(`${BASE}/realms/:name/clients/:id`, async ({ params, request }) => {
    const body = await request.json() as Partial<ReturnType<typeof makeClient>>;
    return HttpResponse.json(makeClient({ id: params.id as string, ...body }));
  }),

  http.delete(`${BASE}/realms/:name/clients/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
