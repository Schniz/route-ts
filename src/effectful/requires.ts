import { Context, Effect, pipe } from "effect";
import { Route } from "./types";

export function requires<R>(_tag?: Context.Tag<R, any>) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
  ): Route<Ann, Rin | R, Rout | R, Ein, Eout, Ain, Aout> => {
    return {
      ...route,
      handler: (next) =>
        pipe(
          Effect.context<R>(),
          Effect.flatMap((c) =>
            pipe(
              route.handler(
                pipe(
                  Effect.context<Rout>(),
                  Effect.flatMap((rOut) =>
                    pipe(next, Effect.provide(Context.merge(c, rOut)))
                  )
                )
              )
            )
          )
        ),
    };
  };
}
