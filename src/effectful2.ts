import { Effect, pipe, Option, flow, Context } from "effect";
import {
  HttpRequest,
  withRequest,
  HttpMethod,
  Method,
  HttpUrl,
  Nothing,
  HttpMethodId,
} from "./effectful";

type Route<Annotations, R, E, A> = {
  annotations: Annotations;
  effect: Effect.Effect<R, E, Option.Option<A>>;
};

function withRoute<R, E, A, R2, E2, A2>(
  f: (
    effect: Effect.Effect<R, E, Option.Option<A>>
  ) => Effect.Effect<R2, E2, Option.Option<A2>>
) {
  return <Ann>(route: Route<Ann, R, E, A>): Route<Ann, R2, E2, A2> => {
    return {
      ...route,
      effect: f(route.effect),
    };
  };
}

const handlerLogic = Effect.gen(function* ($) {
  const request = yield* $(HttpRequest);
  const method = yield* $(HttpMethod);
  return new Response("Hello!");
});

function annotate<Ann1, Ann2>(fn: (ann: Ann1) => Ann2) {
  return <R, E, A>(route: Route<Ann1, R, E, A>): Route<Ann2, R, E, A> => {
    return {
      ...route,
      annotations: fn(route.annotations),
    };
  };
}

function method<M extends Method>(m: M) {
  return <Ann, R, E, A>(route: Route<Ann, R, E, A>) => {
    return pipe(
      route,
      annotate((ann) => ({ ...ann, method: m })),
      withRoute((effect) =>
        Effect.gen(function* ($) {
          const request = yield* $(HttpRequest);
          if (request.method === m) {
            return yield* $(effect, Effect.provideService(HttpMethod, m));
          }
          return Option.none();
        })
      )
    );
  };
}

function handler<R, E, A>(
  effect: Effect.Effect<R, E, A>
): Route<Nothing, R, E, A> {
  return {
    annotations: {},
    effect: pipe(effect, Effect.map(Option.some)),
  };
}

type Contextual<Services> = {
  get<T extends Context.ValidTagsById<Services>>(
    tag: T
  ): Context.Tag.Service<T>;
};

function createContextual<R>(context: Context.Context<R>): Contextual<R> {
  return {
    get: (tag) => {
      return Context.get(context, tag);
    },
  };
}

function urlParser() {
  return <Ann, R, E, A>(route: Route<Ann, R, E, A>) => {
    return pipe(
      route,
      withRoute((effect) =>
        Effect.gen(function* ($) {
          const request = yield* $(HttpRequest);
          const url = new URL(request.url);
          return yield* $(effect, Effect.provideService(HttpUrl, url));
        })
      )
    );
  };
}

function promiseHandler<R, A>(
  fn: (context: Contextual<R>) => Promise<A>
): Route<Nothing, R, unknown, A> {
  return {
    annotations: {},
    effect: Effect.gen(function* ($) {
      const context = yield* $(Effect.context<R>());
      const result = yield* $(
        Effect.tryPromise(() => fn(createContextual(context)))
      );
      return Option.some(result);
    }),
  };
}

function toEffect<R, E, A>(route: Route<unknown, R, E, A>) {
  return route.effect;
}

pipe(
  promiseHandler(async (context: Contextual<HttpMethodId>) => {
    context.get(HttpMethod);
    return new Response("hi");
  }),
  flow(urlParser(), method("GET")),
  toEffect,
  withRequest(new Request("https://example.com")),
  Effect.runSync
);
