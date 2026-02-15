import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRealmByName, updateRealm, deleteRealm } from '../../api/realms';
import { getUsers } from '../../api/users';
import { getClients } from '../../api/clients';
import { getRealmRoles } from '../../api/roles';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function RealmDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);

  const { data: realm, isLoading } = useQuery({
    queryKey: ['realm', name],
    queryFn: () => getRealmByName(name!),
    enabled: !!name,
  });

  const { data: users } = useQuery({
    queryKey: ['users', name],
    queryFn: () => getUsers(name!),
    enabled: !!name,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', name],
    queryFn: () => getClients(name!),
    enabled: !!name,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles', name],
    queryFn: () => getRealmRoles(name!),
    enabled: !!name,
  });

  const [form, setForm] = useState({
    displayName: '',
    enabled: true,
    accessTokenLifespan: 300,
    refreshTokenLifespan: 1800,
  });

  useEffect(() => {
    if (realm) {
      setForm({
        displayName: realm.displayName,
        enabled: realm.enabled,
        accessTokenLifespan: realm.accessTokenLifespan,
        refreshTokenLifespan: realm.refreshTokenLifespan,
      });
    }
  }, [realm]);

  const updateMutation = useMutation({
    mutationFn: () => updateRealm(name!, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realm', name] });
      queryClient.invalidateQueries({ queryKey: ['realms'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRealm(name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realms'] });
      navigate('/console/realms');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading realm...</div>
      </div>
    );
  }

  if (!realm) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Realm not found.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{realm.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Realm settings and overview</p>
        </div>
        <button
          onClick={() => setShowDelete(true)}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete Realm
        </button>
      </div>

      {/* Quick links to sub-resources */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Link
          to={`/console/realms/${name}/users`}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div>
            <p className="text-sm font-medium text-gray-500">Users</p>
            <p className="text-2xl font-bold text-gray-900">{users?.length ?? '-'}</p>
          </div>
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          to={`/console/realms/${name}/clients`}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div>
            <p className="text-sm font-medium text-gray-500">Clients</p>
            <p className="text-2xl font-bold text-gray-900">{clients?.length ?? '-'}</p>
          </div>
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          to={`/console/realms/${name}/roles`}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div>
            <p className="text-sm font-medium text-gray-500">Roles</p>
            <p className="text-2xl font-bold text-gray-900">{roles?.length ?? '-'}</p>
          </div>
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Realm Settings</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={realm.name}
            disabled
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400">Realm name cannot be changed</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Display Name</label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Access Token Lifespan (seconds)
            </label>
            <input
              type="number"
              min={1}
              value={form.accessTokenLifespan}
              onChange={(e) =>
                setForm({ ...form, accessTokenLifespan: Number(e.target.value) })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Refresh Token Lifespan (seconds)
            </label>
            <input
              type="number"
              min={1}
              value={form.refreshTokenLifespan}
              onChange={(e) =>
                setForm({ ...form, refreshTokenLifespan: Number(e.target.value) })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
            Enabled
          </label>
        </div>

        {updateMutation.isSuccess && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            Realm updated successfully.
          </div>
        )}

        {updateMutation.isError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to update realm.
          </div>
        )}

        <div className="flex justify-end border-t border-gray-200 pt-4">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showDelete}
        title="Delete Realm"
        message={`Are you sure you want to delete the realm "${realm.name}"? This action is irreversible and will delete all associated users, clients, and roles.`}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
