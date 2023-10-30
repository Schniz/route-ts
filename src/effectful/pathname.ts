import { Effect, Context, Option } from "effect";
import { parse } from "regexparam";
import { HttpRequestId, HttpUrl } from "./request";
import { Route } from "./types";

export type PathParamId<ParamName> = {
  readonly _: unique symbol;
  readonly "@route-ts/path-param": ParamName;
};
export const PathParam = <ParamName extends string>(paramName: ParamName) =>
  Context.Tag<PathParamId<ParamName>, string>(`@route-ts/param/${paramName}`);

export type PathnameId = { readonly "@route-ts/pathname": unique symbol };
export const Pathname = Context.Tag<PathnameId, string>();

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

export type PathnameContext<Pathname extends string> =
  ParamsFromPath<Pathname> extends infer Params
    ? { [key in keyof Params]: PathParamId<key> }[keyof Params]
    : never;

function applyPathnames<Key extends string>(params: [Key, string][]) {
  return <R, E, A>(
    effect: Effect.Effect<R, E, A>
  ): Effect.Effect<R | { [key in Key]: PathParamId<key> }[Key], E, A> => {
    return params.reduce((effect, [key, value]) => {
      return Effect.provideService(effect, PathParam(key), value);
    }, effect);
  };
}

export function pathname<Pathname extends string>(pathname: Pathname) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout | HttpRequestId, Ein, Eout, Ain, Aout>
  ): Route<
    Ann & { pathname: Pathname },
    Rin,
    | Rout
    | HttpRequestId
    | PathnameId
    | {
        [key in keyof ParamsFromPath<Pathname>]: PathParamId<key>;
      }[keyof ParamsFromPath<Pathname>],
    Ein,
    Eout,
    Ain,
    Aout
  > => {
    const pathnameParser = parse(pathname);
    return {
      _tag: "route.ts",
      annotations: { ...route.annotations, pathname },
      desc: `${route.desc} -> pathname(${pathname})`,
      handler: (next) =>
        route.handler(
          // @ts-ignore
          Effect.gen(function* (_) {
            const url = yield* _(HttpUrl);
            const match = pathnameParser.pattern.exec(url.pathname);
            if (!match) {
              return Option.none();
            }

            const pathParams: [
              Extract<keyof ParamsFromPath<Pathname>, string>,
              string
            ][] = [];
            for (let i = 1; i < match.length; i++) {
              const key = pathnameParser.keys[i - 1];
              const value = match[i];
              pathParams.push([key as any, value]);
            }
            return yield* _(
              next,
              Effect.provideService(Pathname, pathname),
              applyPathnames(pathParams)
            );
          })
        ),
    };
  };
}
