import { useQuery } from '@tanstack/react-query';
import { getAllRealms } from '../api/realms';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: realms, isLoading } = useQuery({
    queryKey: ['realms'],
    queryFn: getAllRealms,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const enabledCount = realms?.filter((r) => r.enabled).length ?? 0;
  const disabledCount = (realms?.length ?? 0) - enabledCount;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your Authme identity server
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Realms</p>
              <p className="text-3xl font-bold text-gray-900">
                {realms?.length ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Enabled Realms</p>
              <p className="text-3xl font-bold text-gray-900">{enabledCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Disabled Realms</p>
              <p className="text-3xl font-bold text-gray-900">{disabledCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Realm quick-access list */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Realms</h2>
        {realms && realms.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realms.map((realm) => (
              <button
                key={realm.id}
                onClick={() => navigate(`/console/realms/${realm.name}`)}
                className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    {realm.displayName || realm.name}
                  </h3>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      realm.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {realm.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{realm.name}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">No realms yet.</p>
            <button
              onClick={() => navigate('/console/realms/create')}
              className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Create your first realm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
