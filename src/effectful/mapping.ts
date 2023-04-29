import { Effect, pipe, Option, Context } from "./dependencies";
import { joinDesc } from "./helpers";
import { Nothing, Route } from "./types";

export function described(
  desc: string
): <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
  route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
) => Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout> {
  return (route) => {
    return {
      ...route,
      desc: joinDesc(route.desc, desc),
    };
  };
}

export function mappedResponse<Aout, Anew>(transformBack: (a: Anew) => Aout) {
  return <Ann, Rin, Rout, Ein, Eout, Ain>(
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
  ): Route<Ann, Rin, Rout, Ein, Eout, Ain, Anew> => {
    return {
      ...route,
      handler: (next) => {
        return route.handler(pipe(next, Effect.map(Option.map(transformBack))));
      },
    };
  };
}

export function annotate<Ann, NewAnn>(fn: (ann: Ann) => NewAnn) {
  return <Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
  ): Route<NewAnn, Rin, Rout, Ein, Eout, Ain, Aout> => {
    return {
      ...route,
      annotations: fn(route.annotations),
    };
  };
}

export function provideServiceEffect<T extends Context.Tag<any, any>, TR, TE>(
  service: T,
  implementation: Effect.Effect<TR, TE, Context.Tag.Service<T>>
) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout | TR, Ein, Eout | TE, Ain, Aout>
  ): Route<
    Ann,
    Rin,
    Rout | Context.Tag.Identifier<T> | TR,
    Ein,
    Eout,
    Ain,
    Aout
  > => {
    return {
      ...route,
      handler: (next) =>
        route.handler(
          pipe(next, Effect.provideServiceEffect(service, implementation))
        ),
    };
  };
}

export function provideSomeServiceEffect<
  T extends Context.Tag<any, any>,
  TR,
  TE
>(
  tag: T,
  implementation: Effect.Effect<TR, TE, Option.Option<Context.Tag.Service<T>>>
) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout | TR, Ein, Eout | TE, Ain, Aout>
  ): Route<
    Ann,
    Rin,
    Rout | Context.Tag.Identifier<T> | TR,
    Ein,
    Eout,
    Ain,
    Aout
  > => {
    return {
      ...route,
      handler: (next) =>
        route.handler(
          Effect.gen(function* ($) {
            const service = yield* $(implementation);
            if (Option.isNone(service)) {
              return Option.none();
            }
            return yield* $(next, Effect.provideService(tag, service.value));
          })
        ),
    };
  };
}

export function flatMapHandler<
  Rin,
  Rout,
  Ein,
  Eout,
  Ain,
  Aout,
  Rout2,
  Eout2,
  Aout2
>(
  cb: (
    handler: Route<Nothing, Rin, Rout, Ein, Eout, Ain, Aout>["handler"]
  ) => Route<Nothing, Rin, Rout2, Ein, Eout2, Ain, Aout2>["handler"]
) {
  return <Ann>(
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
  ): Route<Ann, Rin, Rout2, Ein, Eout2, Ain, Aout2> => {
    return {
      ...route,
      handler: cb(route.handler),
    };
  };
}