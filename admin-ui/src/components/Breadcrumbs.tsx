import { Link, useLocation, useParams } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string;
}

function useBreadcrumbs(): Crumb[] {
  const location = useLocation();
  const params = useParams<Record<string, string>>();
  const pathname = location.pathname;

  // Strip /console prefix for matching
  const path = pathname.replace(/^\/console/, '') || '/';
  const segments = path.split('/').filter(Boolean);

  const crumbs: Crumb[] = [{ label: 'Home', to: '/console' }];

  if (segments.length === 0) {
    // Dashboard root — just "Home"
    return crumbs;
  }

  // Walk through segments and build breadcrumbs
  let current = '/console';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    current = `${current}/${seg}`;

    // Determine a human-readable label
    let label = seg;

    // Known static segments
    const staticLabels: Record<string, string> = {
      realms: 'Realms',
      create: 'Create',
      users: 'Users',
      clients: 'Clients',
      roles: 'Roles',
      groups: 'Groups',
      sessions: 'Sessions',
      events: 'Events',
      'admin-events': 'Admin Events',
      'client-scopes': 'Client Scopes',
      'user-federation': 'User Federation',
      'identity-providers': 'Identity Providers',
      'saml-providers': 'SAML Providers',
      new: 'New',
    };

    if (staticLabels[seg]) {
      label = staticLabels[seg];
    } else {
      // Dynamic segment — check if it matches a known param pattern
      // Position 1 (after realms): realm name
      if (segments[i - 1] === 'realms') {
        label = params.name ?? seg;
      }
      // User id
      else if (segments[i - 1] === 'users') {
        label = params.id ?? seg;
      }
      // Client id
      else if (segments[i - 1] === 'clients') {
        label = params.id ?? seg;
      }
      // Group id
      else if (segments[i - 1] === 'groups') {
        label = params.groupId ?? seg;
      }
      // Client scope id
      else if (segments[i - 1] === 'client-scopes') {
        label = params.scopeId ?? seg;
      }
      // Identity provider alias
      else if (segments[i - 1] === 'identity-providers') {
        label = params.alias ?? seg;
      }
      // SAML SP id
      else if (segments[i - 1] === 'saml-providers') {
        label = params.id ?? seg;
      }
      // User federation id
      else if (segments[i - 1] === 'user-federation') {
        label = params.id ?? seg;
      }
    }

    const isLast = i === segments.length - 1;
    crumbs.push({ label, to: isLast ? undefined : current });
  }

  return crumbs;
}

export default function Breadcrumbs() {
  const crumbs = useBreadcrumbs();

  // Don't render breadcrumbs on the dashboard root (only has "Home")
  if (crumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-gray-500">
      <ol className="flex items-center gap-1 list-none p-0 m-0">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <svg
                  className="h-4 w-4 flex-shrink-0 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isLast || !crumb.to ? (
                <span
                  className={isLast ? 'font-medium text-gray-900' : 'text-gray-500'}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="hover:text-indigo-600 hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
