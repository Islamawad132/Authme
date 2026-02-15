import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserById, updateUser, deleteUser, resetPassword } from '../../api/users';
import {
  getRealmRoles,
  getUserRealmRoles,
  assignUserRealmRoles,
  removeUserRealmRoles,
} from '../../api/roles';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function UserDetailPage() {
  const { name, id } = useParams<{ name: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', name, id],
    queryFn: () => getUserById(name!, id!),
    enabled: !!name && !!id,
  });

  const { data: allRoles } = useQuery({
    queryKey: ['roles', name],
    queryFn: () => getRealmRoles(name!),
    enabled: !!name,
  });

  const { data: userRoles, refetch: refetchUserRoles } = useQuery({
    queryKey: ['userRoles', name, id],
    queryFn: () => getUserRealmRoles(name!, id!),
    enabled: !!name && !!id,
  });

  const [form, setForm] = useState({
    email: '',
    emailVerified: false,
    firstName: '',
    lastName: '',
    enabled: true,
  });

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email ?? '',
        emailVerified: user.emailVerified,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        enabled: user.enabled,
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: () => updateUser(name!, id!, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', name, id] });
      queryClient.invalidateQueries({ queryKey: ['users', name] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(name!, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', name] });
      navigate(`/console/realms/${name}/users`);
    },
  });

  const resetPwMutation = useMutation({
    mutationFn: () => resetPassword(name!, id!, newPassword),
    onSuccess: () => {
      setNewPassword('');
      setPasswordMsg('Password reset successfully.');
    },
    onError: () => {
      setPasswordMsg('Failed to reset password.');
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: (roleName: string) => assignUserRealmRoles(name!, id!, [roleName]),
    onSuccess: () => {
      refetchUserRoles();
      setSelectedRole('');
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: (roleName: string) => removeUserRealmRoles(name!, id!, [roleName]),
    onSuccess: () => {
      refetchUserRoles();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateMutation.mutate();
  }

  function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg('');
    resetPwMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading user...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        User not found.
      </div>
    );
  }

  const assignedRoleNames = new Set(userRoles?.map((r) => r.name) ?? []);
  const availableRoles = allRoles?.filter((r) => !assignedRoleNames.has(r.name)) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.username}</h1>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        </div>
        <button
          onClick={() => setShowDelete(true)}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete User
        </button>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            value={user.username}
            disabled
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              id="emailVerified"
              checked={form.emailVerified}
              onChange={(e) => setForm({ ...form, emailVerified: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="emailVerified" className="text-sm font-medium text-gray-700">
              Email Verified
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
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
            User updated successfully.
          </div>
        )}

        {updateMutation.isError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to update user.
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

      {/* Set Password */}
      <form onSubmit={handleResetPassword} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Set Password</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">New Password</label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {passwordMsg && (
          <div
            className={`rounded-md p-3 text-sm ${
              passwordMsg.includes('success')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {passwordMsg}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={resetPwMutation.isPending}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {resetPwMutation.isPending ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>

      {/* Role Mappings */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Role Mappings</h2>

        {/* Assigned roles */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">Assigned Roles</h3>
          {userRoles && userRoles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {userRoles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700"
                >
                  {role.name}
                  <button
                    type="button"
                    onClick={() => removeRoleMutation.mutate(role.name)}
                    className="ml-1 text-indigo-400 hover:text-indigo-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No roles assigned.</p>
          )}
        </div>

        {/* Add role */}
        {availableRoles.length > 0 && (
          <div className="flex items-end gap-3 border-t border-gray-200 pt-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Add Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select a role...</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => selectedRole && assignRoleMutation.mutate(selectedRole)}
              disabled={!selectedRole || assignRoleMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Assign
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDelete}
        title="Delete User"
        message={`Are you sure you want to delete user "${user.username}"? This action is irreversible.`}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
