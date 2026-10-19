/**
 * The site's two views, as a hash route.
 *
 * A hash rather than a path because the app ships as a static bundle: `/solution`
 * would need a server rewrite on every host it lands on, while `#/solution` works
 * from a file, a Render static site or GitHub Pages without one. The route is
 * read from `location.hash`, so reloading, sharing a link and going back all
 * behave the way a tab is expected to.
 *
 * The landing page is the default. A shared *solution* link carries the app's
 * state in the query string (`?site=pred-004`), and landing on the cover with a
 * site pre-selected behind it would be a dead end, so the presence of that query
 * counts as a request for the solution.
 */

import { useCallback, useEffect, useState } from 'react';

export type Route = 'home' | 'solution' | 'team';

export const ROUTES: readonly Route[] = ['home', 'solution', 'team'];

function parse(hash: string): Route | null {
  const value = hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();
  const known: Route[] = ['home', 'solution', 'team'];
  return known.includes(value as Route) ? (value as Route) : null;
}

function readRoute(): Route {
  if (typeof window === 'undefined') return 'home';
  const fromHash = parse(window.location.hash);
  if (fromHash) return fromHash;
  const params = new URLSearchParams(window.location.search);
  return params.has('site') || params.has('target') || params.has('terrain')
    ? 'solution'
    : 'home';
}

/** `#/home` and `#/solution`, for links that must survive a middle click. */
export function routeHref(route: Route): string {
  return `#/${route}`;
}

/**
 * The current route and a way to change it. The change is a real hash
 * navigation, so the back button walks between the two views.
 */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((next: Route) => {
    const target = routeHref(next);
    if (window.location.hash === target) return;
    window.location.hash = target;
    // New view, new page position: a shared link should not land halfway down
    // the workbench.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return [route, go];
}
