import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAllRealms } from '../api/realms';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { name: currentRealm } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [realmDropdownOpen, setRealmDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: realms } = useQuery({
    queryKey: ['realms'],
    queryFn: getAllRealms,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRealmDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = currentRealm
    ? [
        { to: `/console/realms/${currentRealm}`, label: 'Overview' },
        { to: `/console/realms/${currentRealm}/users`, label: 'Users' },
        { to: `/console/realms/${currentRealm}/clients`, label: 'Clients' },
        { to: `/console/realms/${currentRealm}/roles`, label: 'Roles' },
        { to: `/console/realms/${currentRealm}/groups`, label: 'Groups' },
        { to: `/console/realms/${currentRealm}/client-scopes`, label: 'Client Scopes' },
        { to: `/console/realms/${currentRealm}/sessions`, label: 'Sessions' },
        { to: `/console/realms/${currentRealm}/events`, label: 'Events' },
        { to: `/console/realms/${currentRealm}/admin-events`, label: 'Admin Events' },
        { to: `/console/realms/${currentRealm}/user-federation`, label: 'User Federation' },
        { to: `/console/realms/${currentRealm}/identity-providers`, label: 'Identity Providers' },
        { to: `/console/realms/${currentRealm}/saml-providers`, label: 'SAML Providers' },
      ]
    : [];

  const globalNav = [
    { to: '/console', label: 'Dashboard', end: true },
    { to: '/console/realms', label: 'Realms', end: false },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col bg-gray-900 text-white transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-gray-700 px-6">
          <img src="/console/authme-logo.png" alt="AuthMe" className="h-8 w-auto" />
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {globalNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {currentRealm && realms?.some((r) => r.name === currentRealm) && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {currentRealm}
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 lg:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Realm switcher */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setRealmDropdownOpen(!realmDropdownOpen)}
                className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>{currentRealm || 'Select Realm'}</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {realmDropdownOpen && realms && (
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  {realms.map((realm) => (
                    <button
                      key={realm.id}
                      onClick={() => {
                        navigate(`/console/realms/${realm.name}`);
                        setRealmDropdownOpen(false);
                      }}
                      className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                        realm.name === currentRealm
                          ? 'bg-indigo-50 font-medium text-indigo-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {realm.displayName || realm.name}
                    </button>
                  ))}
                  {realms.length === 0 && (
                    <p className="px-4 py-2 text-sm text-gray-500">No realms found</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={logout}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Logout
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
