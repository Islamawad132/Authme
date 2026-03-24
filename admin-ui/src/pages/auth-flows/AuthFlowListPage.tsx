import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuthFlows, createAuthFlow, deleteAuthFlow, type AuthFlow } from '../../api/authFlows';
import { getErrorMessage } from '../../utils/getErrorMessage';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function AuthFlowListPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState<AuthFlow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: flows, isLoading, error } = useQuery({
    queryKey: ['auth-flows', name],
    queryFn: () => getAuthFlows(name!),
    enabled: !!name,
  });

  const createMutation = useMutation({
    mutationFn: (flowName: string) =>
      createAuthFlow(name!, {
        name: flowName,
        description: '',
        isDefault: false,
        steps: [],
      }),
    onSuccess: (flow) => {
      qc.invalidateQueries({ queryKey: ['auth-flows', name] });
      navigate(`/console/realms/${name}/auth-flows/${flow.id}`);
    },
    onError: (err) => setCreateError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAuthFlow(name!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-flows', name] });
      setDeleteTarget(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (flow: AuthFlow) =>
      createAuthFlow(name!, {
        name: `${flow.name} (copy)`,
        description: flow.description ?? '',
        isDefault: false,
        steps: flow.steps,
      }),
    onSuccess: (flow) => {
      qc.invalidateQueries({ queryKey: ['auth-flows', name] });
      navigate(`/console/realms/${name}/auth-flows/${flow.id}`);
    },
  });

  function handleCreate() {
    const flowName = window.prompt('Enter a name for the new authentication flow:');
    if (!flowName?.trim()) return;
    setCreateError(null);
    createMutation.mutate(flowName.trim());
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading authentication flows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load authentication flows.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Authentication Flows</h1>
          <p className="mt-1 text-sm text-gray-500">
            Design and manage authentication flows for{' '}
            <span className="font-medium">{name}</span>
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Flow'}
        </button>
      </div>

      {createError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {createError}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Steps
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Default
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Last Modified
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {flows && flows.length > 0 ? (
              flows.map((flow) => (
                <tr
                  key={flow.id}
                  className="hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <button
                      onClick={() => navigate(`/console/realms/${name}/auth-flows/${flow.id}`)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-900"
                    >
                      {flow.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {flow.description || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {flow.steps.length}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {flow.isDefault && (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(flow.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/console/realms/${name}/auth-flows/${flow.id}`)}
                        className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => duplicateMutation.mutate(flow)}
                        disabled={duplicateMutation.isPending}
                        className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => setDeleteTarget(flow)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  No authentication flows found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Authentication Flow"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
