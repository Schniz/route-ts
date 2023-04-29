import { Context, Effect, Option, pipe } from "./dependencies";
import { annotate, described, provideSomeServiceEffect } from "./mapping";
import { HttpRequest, HttpRequestId } from "./request";
import { Route } from "./types";

export type Method =
  | "POST"
  | "GET"
  | "PATCH"
  | "PUT"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type HttpMethodId = { readonly "@route-ts/method": unique symbol };
export const HttpMethod = Context.Tag<HttpMethodId, Method>();

export function method<M extends Method>(method: M) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout | HttpRequestId, Ein, Eout, Ain, Aout>
  ) => {
    return pipe(
      route,
      described(`method(${method})`),
      annotate((ann) => ({ ...ann, method })),
      provideSomeServiceEffect(
        HttpMethod,
        Effect.gen(function* (_) {
          const request = yield* _(HttpRequest);
          if (request.method !== method) {
            return Option.none();
          } else {
            return Option.some(method);
          }
        })
      )
    );
  };
}
