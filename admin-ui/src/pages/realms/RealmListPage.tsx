import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAllRealms } from '../../api/realms';

export default function RealmListPage() {
  const navigate = useNavigate();

  const { data: realms, isLoading, error } = useQuery({
    queryKey: ['realms'],
    queryFn: getAllRealms,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading realms...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load realms. Please try again.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Realms</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your identity realms
          </p>
        </div>
        <button
          onClick={() => navigate('/console/realms/create')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create Realm
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Display Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Enabled
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {realms && realms.length > 0 ? (
              realms.map((realm) => (
                <tr
                  key={realm.id}
                  onClick={() => navigate(`/console/realms/${realm.name}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-indigo-600">
                    {realm.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {realm.displayName}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        realm.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {realm.enabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(realm.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                  No realms found. Create your first realm to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
