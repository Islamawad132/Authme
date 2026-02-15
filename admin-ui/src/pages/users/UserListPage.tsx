import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getUsers } from '../../api/users';

export default function UserListPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users', name],
    queryFn: () => getUsers(name!),
    enabled: !!name,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load users.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage users in <span className="font-medium">{name}</span>
          </p>
        </div>
        <button
          onClick={() => navigate(`/console/realms/${name}/users/create`)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create User
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
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
            {users && users.length > 0 ? (
              users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => navigate(`/console/realms/${name}/users/${user.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-indigo-600">
                    {user.username}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {user.email}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {user.enabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  No users found in this realm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
