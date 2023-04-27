import * as Effect from "@effect/io/Effect";
import { Layer } from "./v2";
import { Passthrough } from "../dist";
import { pipe } from '@effect/data/Function'
import * as Option from "@effect/data/Option";

type MaybePromise<T> = T | Promise<T>;

export function effectful<A, C, O>(): Layer<{
  annotation: Passthrough<A>;
  context: Passthrough<C>;
  return: {
    out: O;
    in: Effect.Effect<never, never, O>;
  };
}> {
  return {
    tag: `effectful`,
    annotate(current, next) {
      return next(current);
    },
    async middleware(context, next) {
      const effect = await next(context);
      if (effect) {
        return Effect.runPromise(effect);
      }
    },
  };
}

type Route<Context, NextFnContext, Annotations, Return, NextFnReturn> = {
  _tag: "Route.ts",
  desc: string;
  handler: Handler<Context, Return, NextFnContext, NextFnReturn>,
  annotations: Annotations,
}

type AnyRoute = Route<any, any, any, any, any>;
type NextFn<Context, RT> = (context: Context) => Option.Option<RT>;

type Handler<Context, Return, NextFnContext, NextFnReturn> = (context: Context, next: NextFn<NextFnContext, NextFnReturn>) => Return;

function method<M extends string>(m: M) {
  return <Context extends { request: Request }, Annotations, ReturnType, PrevContext, PrevReturnType>(route: Route<PrevContext, Context, Annotations, PrevReturnType, ReturnType>) => {
    return {
      _tag: "Route.ts",
      desc: `method(${m})(${route.desc})` as const,
      annotations: { ...route.annotations, method: m },
      handler(context: PrevContext, next: NextFn<Context & { method: M }, ReturnType>) {
        return route.handler(context, () => {
          throw new Error('bluh');
        });
      },
    } satisfies AnyRoute;
  }
}

type Nothing = Record<never, never>;
const routeTag = 'Route.ts' as const;

function http<Context = Nothing>() {
  return {
    _tag: routeTag,
    desc: `http` as const,
    annotations: {} as const,
    handler(context: Context & { request: Request }, next: NextFn<Context & { request: Request, url: URL }, MaybePromise<Response>>) {
      return next({ ...context, url: new URL(context.request.url) });
    }
  }
}

function handle<Context, ReturnType>(fn: (context: Context) => ReturnType) {
  return <Annotations, PrevContext, PrevReturnType>(route: Route<PrevContext, Context, Annotations, PrevReturnType, ReturnType>) => {
    return {
      _tag: routeTag,
      desc: `handle(${route.desc})` as const,
      annotations: route.annotations,
      handler(context: PrevContext, _next: NextFn<never, never>) {
        return route.handler(context, context => Option.some(fn(context)));
      },
    } satisfies Route<PrevContext, never, Annotations, PrevReturnType, never>;
  }
}

const r = pipe(
  http(),
  method('GET'),
  handle(async context => {
    return new Response(context.url.pathname);
  })
)
