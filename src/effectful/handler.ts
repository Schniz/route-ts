import { Effect, pipe, Option } from "./dependencies";
import { joinDesc } from "./helpers";
import { Route } from "./types";

export function handler<R, E, A>(effect: Effect.Effect<R, E, A>) {
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
