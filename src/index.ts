type MaybePromise<T> = T | Promise<T>;
type Nothing = Record<never, never>;
export type NextFn<Env> = (
  request: Request,
  env: Env
) => MaybePromise<Response | undefined>;
export type Guard<Provides, Env = Nothing> = (
  request: Request,
  env: Env,
  next: NextFn<Provides>
) => MaybePromise<Response | undefined>;

type Guardable<Provides, Env> = Guard<Provides, Env> | Guards<Provides, Env>;

function intoGuards<Provides, Env>(
  guard: Guardable<Provides, Env>
): Guards<Provides, Env> {
  if (guard instanceof Guards) {
    return guard;
  }
  return new Guards(guard);
}

export class Guards<Provides, Env> {
  constructor(private readonly guard: Guard<Provides, Env>) {}

  /**
   * Chain a guard to this one. If the guard returns a response, the execution
   */
  andThen<NextProvides>(
    nextGuard: Guardable<NextProvides, Provides>
  ): Guards<NextProvides, Env> {
    const ng = intoGuards(nextGuard);
    return intoGuards<NextProvides, Env>((req, env, next) => {
      return this.guard(req, env, (req, env) => {
        return ng.execute(req, env, next);
      });
    });
  }

  /**
   * Execute a list of guards in order. If one of the guards returns a response,
   * the execution stops and the response is returned.
   */
  switches(
    fn: (route: Guards<Provides, Env>) => Guardable<never, Provides>[]
  ): Guards<never, Env> {
    const guards = fn(this).map(intoGuards);
    return this.andThen(async (req, env, next) => {
      for (const g of guards) {
        const result: Response | undefined = await g.execute(req, env, next);
        if (result) {
          return result;
        }
      }
      return undefined;
    });
  }

  /**
   * Execute this guard
   */
  execute(
    ...args: Parameters<Guard<Provides, Env>>
  ): ReturnType<Guard<Provides, Env>> {
    return this.guard(...args);
  }
}

/**
 * A helper to create a guard
 */
export function guard<Provider, Env>(
  guard: Guard<Provider, Env>
): typeof guard {
  return guard;
}

/**
 * A guard that parses a URL and adds it to the environment
 */
export function parseUrl<Env>(): Guard<Env & { url: URL }, Env> {
  return guard((req, env, next) => {
    return next(req, { ...env, url: new URL(req.url) });
  });
}

export function router<BaseEnv>(): Guards<BaseEnv, BaseEnv> {
  return new Guards((req, env, next) => next(req, env));
}

/**
 * A helper to create a guard that handles all requests
 * and never forwards to the next guard.
 */
export function handler<Env>(
  fn: (request: Request, env: Env) => MaybePromise<Response | undefined>
): Guard<never, Env> {
  return guard(fn);
}

type NormalizeParam<T extends string> = T extends `${infer Prefix}*`
  ? [Prefix, string]
  : [T, string];

type ParamsFromPath<Pathname extends string> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Pathname extends `${infer _}:${infer Param}/${infer Rest}`
    ? { [K in NormalizeParam<Param> as K[0]]: K[1] } & ParamsFromPath<Rest>
    : // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Pathname extends `${infer _}:${infer Param}`
    ? { [K in NormalizeParam<Param> as K[0]]: K[1] }
    : Record<never, never>;

/**
 * Guard against a path. This will parse the path and add the params to the
 * environment.
 */
export function pathname<Env extends { url: URL }, Pathname extends string>(
  path: Pathname
) {
  const pattern = new URLPattern({ pathname: path });
  return guard<
    Env & { path: { params: ParamsFromPath<Pathname>; route: Pathname } },
    Env
  >(async (req, env, next) => {
    const parts = pattern.exec(env.url);
    if (!parts) {
      return undefined;
    }
    return next(req, {
      ...env,
      path: {
        route: path,
        params: parts.pathname.groups as ParamsFromPath<Pathname>,
      },
    });
  });
}

type HttpMethod =
  | 'POST'
  | 'GET'
  | 'PATCH'
  | 'PUT'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

/**
 * Guard against an HTTP method
 */
export function method<Env, M extends HttpMethod>(
  method: M
): Guard<Env & { method: M }, Env> {
  return guard(async (req, env, next) => {
    if (req.method.toUpperCase() !== method) {
      return undefined;
    }

    return next(req, { ...env, method });
  });
}

/**
 * Guard against both an HTTP method and a path
 *
 * @eaxmple request('GET /users/:id')
 */
export function request<
  Env extends { url: URL },
  Method extends HttpMethod,
  Pathname extends string
>(
  r: `${Method} ${Pathname}`
): Guard<
  Env & {
    method: Method;
    path: { route: Pathname; params: ParamsFromPath<Pathname> };
  },
  Env
> {
  const [parsedMethod, parsedPathname] = r.split(' ', 2) as [Method, Pathname];
  const g = new Guards(method<Env, Method>(parsedMethod)).andThen(
    pathname(parsedPathname)
  );
  return guard((req, env: Env, next) => {
    return g.execute(req, env, next);
  });
}

export function parsedQuery<Env extends { url: URL }, T>(
  parser: (values: unknown) => MaybePromise<T>
): Guard<Env & { query: T }, Env> {
  return guard(async (req, env, next) => {
    try {
      const query = await parser(Object.fromEntries(env.url.searchParams));
      return next(req, { ...env, query });
    } catch {
      return undefined;
    }
  });
}
