import { Effect, Option } from "effect";
import { AoutOf, EoutOf, RoutOf, Route } from "./types";

export function match<
  Ann,
  Rin,
  Rout,
  Ein,
  Eout,
  Ain,
  Aout,
  NewRoute extends Route<any, Rout, any, Eout, Eout, Aout, any>
>(
  createRoutes: (
    baseRoute: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
  ) => NewRoute[]
) {
  return (
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
  ): Route<
    Ann,
    Rin,
    RoutOf<NewRoute>,
    Ein,
    EoutOf<NewRoute>,
    Ain,
    AoutOf<NewRoute>
  > => {
    const routes = createRoutes(route);
    return {
      ...route,
      handler: (next) => {
        return route.handler(
          Effect.gen(function* (_) {
            for (const nextRoute of routes) {
              const result = yield* _(nextRoute.handler(next));
              if (Option.isSome(result)) {
                return result;
              }
            }
            return Option.none();
          })
        );
      },
    };
  };
}
