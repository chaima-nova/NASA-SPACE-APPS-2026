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

export type Route = 'home' | 'solution' | 'summary' | 'team';

export const ROUTES: readonly Route[] = ['home', 'solution', 'summary', 'team'];

function parse(hash: string): Route | null {
  const value = hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();
  const known: Route[] = ['home', 'solution', 'summary', 'team'];
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

  /**
   * Every route change lands at the top of the new view.
   *
   * A plain `<a href="#/solution">` changes the route through the hash and
   * never passes through `go`, so the old scroll offset survived the swap: click
   * "Open the solution" from the foot of the landing page and the workbench
   * opened already scrolled down. The reset therefore hangs off the route itself
   * rather than off one navigation helper, and covers the hash links, the back
   * button and a shared link alike.
   *
   * Both the document and the workbench's own scroll columns are reset: the
   * solution route is a fixed shell whose ranked list, globe column and dossier
   * scroll inside themselves, so zeroing the window alone would leave those
   * where they were.
   */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const page = document.scrollingElement ?? document.documentElement;
    page.scrollTop = 0;
    document
      .querySelectorAll<HTMLElement>(
        '.app, .layout, .shell, .globe-column, .list-scroll, .dossier-column, .evidence',
      )
      .forEach((node) => {
        node.scrollTop = 0;
      });
  }, [route]);

  const go = useCallback((next: Route) => {
    const target = routeHref(next);
    if (window.location.hash === target) return;
    window.location.hash = target;
  }, []);

  return [route, go];
}
