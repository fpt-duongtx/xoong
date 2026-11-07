export interface RouteLocation {
  /** The path without the router's `base`, e.g. "/users/3". */
  path: string;
  /** Path parameters of the matched route: { id: "3" }. */
  params: Record<string, string>;
  query: URLSearchParams;
  /** Path, query and hash as in the address bar. */
  url: string;
  /** The matched route template, or null when nothing matched (a 404). */
  route: { pattern: string; layout: string | null; title: string; template: HTMLTemplateElement } | null;
}

/** true or undefined: continue. false: cancel. A string: redirect to that path. */
export type GuardResult = boolean | string | void;

export const router: {
  /** Go to a path relative to the base. Resolves with true when the navigation happened. */
  navigate(path: string, options?: { replace?: boolean }): Promise<boolean>;
  /** Run before every navigation; returns a function that removes the guard. */
  guard(fn: (to: RouteLocation, from: RouteLocation | null) => GuardResult | Promise<GuardResult>): () => void;
  /** Run before leaving the current location (links, back/forward, navigate); return false to stay. */
  beforeNavigate(fn: (to: RouteLocation, from: RouteLocation | null, type: 'link' | 'api' | 'popstate') => boolean | void | Promise<boolean | void>): () => void;
  readonly current: RouteLocation | null;
};
