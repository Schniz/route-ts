import type { Layer } from "../v2";
import type { Attaches, Passthrough } from "./type-modifiers";
import { parse } from "regexparam";

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
export function pathname<
  Env extends { url: URL },
  Ann,
  Returns,
  Pathname extends string
>(
  path: Pathname
): Layer<{
  context: Attaches<
    Env,
    { path: { route: Pathname; params: ParamsFromPath<Pathname> } }
  >;
  annotation: Attaches<Ann, { path: Pathname }>;
  return: Passthrough<Returns>;
}> {
  // const pattern = new URLPattern({ pathname: path });
  const regex = parse(path);
  return {
    tag: `pathname(${path})`,
    annotate: (a, next) => next({ ...a, path }),
    middleware: async (context, next) => {
      const match = regex.pattern.exec(context.url.pathname);
      if (!match) return undefined;
      const params: Record<string, string> = {};
      for (let i = 1; i < match.length; i++) {
        params[regex.keys[i - 1]] = match[i];
      }
      return next({
        ...context,
        path: {
          route: path,
          params: params as unknown as ParamsFromPath<Pathname>,
        },
      });

      // const parts = pattern.exec(context.url);
      // if (!parts) {
      //   return undefined;
      // }
      // return next({
      //   ...context,
      //   path: {
      //     route: path,
      //     params: parts.pathname.groups as ParamsFromPath<Pathname>,
      //   },
      // });
    },
  };
}
