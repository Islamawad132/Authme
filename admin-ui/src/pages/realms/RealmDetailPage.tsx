import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRealmByName, updateRealm, deleteRealm } from '../../api/realms';
import { getUsers } from '../../api/users';
import { getClients } from '../../api/clients';
import { getRealmRoles } from '../../api/roles';
import { getGroups } from '../../api/groups';
import ConfirmDialog from '../../components/ConfirmDialog';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function RealmDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'tokens'>('general');

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

  const { data: groups } = useQuery({
    queryKey: ['groups', name],
    queryFn: () => getGroups(name!),
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
        displayName: realm.displayName ?? '',
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

  const tabs = [
    { key: 'general' as const, label: 'General' },
    { key: 'tokens' as const, label: 'Tokens' },
  ];

  const quickLinks = [
    { to: `/console/realms/${name}/users`, label: 'Users', count: users?.length },
    { to: `/console/realms/${name}/clients`, label: 'Clients', count: clients?.length },
    { to: `/console/realms/${name}/roles`, label: 'Roles', count: roles?.length },
    { to: `/console/realms/${name}/groups`, label: 'Groups', count: groups?.length },
    { to: `/console/realms/${name}/sessions`, label: 'Sessions', count: undefined },
    { to: `/console/realms/${name}/identity-providers`, label: 'Identity Providers', count: undefined },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{realm.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {realm.displayName || 'Realm settings and overview'}
          </p>
        </div>
        <button
          onClick={() => setShowDelete(true)}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete Realm
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 py-3 text-sm font-medium ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-8">
          {/* Quick links */}
          <div className="grid gap-4 sm:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div>
                  <p className="text-sm font-medium text-gray-500">{link.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {link.count !== undefined ? link.count : '-'}
                  </p>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>

          {/* General settings form */}
          <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>

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
        </div>
      )}

      {/* Tokens Tab */}
      {activeTab === 'tokens' && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Token Lifespans</h2>
          <p className="text-sm text-gray-500">
            Configure how long access and refresh tokens remain valid.
          </p>

          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Access Token Lifespan
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={form.accessTokenLifespan}
                  onChange={(e) =>
                    setForm({ ...form, accessTokenLifespan: Number(e.target.value) })
                  }
                  className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-sm text-gray-500">seconds</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {formatDuration(form.accessTokenLifespan)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                How long an access token is valid before it must be refreshed.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Refresh Token Lifespan
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={form.refreshTokenLifespan}
                  onChange={(e) =>
                    setForm({ ...form, refreshTokenLifespan: Number(e.target.value) })
                  }
                  className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-sm text-gray-500">seconds</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {formatDuration(form.refreshTokenLifespan)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                How long a refresh token is valid. This also controls session duration.
              </p>
            </div>
          </div>

          {updateMutation.isSuccess && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              Token settings updated successfully.
            </div>
          )}
          {updateMutation.isError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Failed to update token settings.
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
      )}

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
