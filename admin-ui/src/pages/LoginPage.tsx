import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(apiKey);
    if (success) {
      navigate('/console');
    } else {
      setError('Invalid API key. Please check and try again.');
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white px-8 py-10 shadow-lg">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
              <svg
                className="h-8 w-8 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Authme Admin</h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter your admin API key to continue
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="apiKey"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Admin API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                placeholder="Enter your API key"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !apiKey}
              className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
