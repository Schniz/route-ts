import { Effect, pipe, Option, Context } from "effect";
import { joinDesc } from "./helpers";
import { Route } from "./types";

export function handleEffect<R, E, A>(effect: Effect.Effect<R, E, A>) {
  return <Ann, Rin, Ein, Ain>(
    route: Route<Ann, Rin, R, Ein, E, Ain, A>
  ): Route<Ann, Rin, void, Ein, void, Ain, void> => {
    return {
      _tag: "route.ts",
      annotations: route.annotations,
      desc: joinDesc(route.desc, "handler"),
      handler: () => {
        return pipe(effect, Effect.map(Option.some), route.handler);
      },
    };
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

export function handlePromise<R, A>(
  fn: (context: Contextual<R>) => Promise<A>
) {
  return <Ann, Rin, Ein, Ain>(
    route: Route<Ann, Rin, R, Ein, never, Ain, A>
  ) => {
    return {
      _tag: "route.ts" as const,
      annotations: route.annotations,
      desc: joinDesc(route.desc, "handler"),
      handler: () => {
        return pipe(
          Effect.context<R>(),
          Effect.flatMap((context) => {
            return pipe(
              Effect.tryPromise(() => fn(createContextual(context))),
              Effect.map(Option.some)
            );
          }),
          Effect.orDie,
          route.handler
        );
      },
    };
  };
}

export function handleSync<R, A>(fn: (context: Contextual<R>) => A) {
  return <Ann, Rin, Ein, Ain>(
    route: Route<Ann, Rin, R, Ein, never, Ain, A>
  ) => {
    return {
      _tag: "route.ts" as const,
      annotations: route.annotations,
      desc: joinDesc(route.desc, "handler"),
      handler: () => {
        return pipe(
          Effect.context<R>(),
          Effect.flatMap((context) => {
            return pipe(
              Effect.try(() => fn(createContextual(context))),
              Effect.map(Option.some)
            );
          }),
          Effect.orDie,
          route.handler
        );
      },
    };
  };
}
