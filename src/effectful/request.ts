import { Context, Effect, pipe, Function } from "./dependencies";
import { Nothing, Route } from "./types";
import { provideServiceEffect } from "./mapping";

export type HttpRequestId = { readonly _: unique symbol };
/**
 * Grab the request object from the context
 */
export const HttpRequest = Context.Tag<HttpRequestId, Request>();

export type HttpUrlId = { readonly _: unique symbol };
export const HttpUrl = Context.Tag<HttpUrlId, URL>();

export function http<R = never, E = never, A = Response>(): Route<
  Nothing,
  R | HttpUrlId | HttpRequestId,
  R | HttpUrlId | HttpRequestId,
  E,
  E,
  A,
  A
> {
  return {
    _tag: "route.ts",
    annotations: {},
    desc: "http",
    handler: Function.identity,
  };
}

export function root<Rin = never>(): Route<
  Nothing,
  Rin | HttpRequestId,
  Rin | HttpRequestId | HttpUrlId,
  never,
  never,
  Response,
  Response
> {
  return {
    _tag: "route.ts",
    annotations: {},
    desc: "http",
    handler: (next) =>
      pipe(
        next,
        Effect.provideServiceEffect(
          HttpUrl,
          pipe(
            HttpRequest,
            Effect.map((request) => new URL(request.url))
          )
        )
      ),
  };
}

export function empty<R = never, E = never, A = Response>(): Route<
  Nothing,
  R,
  R,
  E,
  E,
  A,
  A
> {
  return {
    _tag: "route.ts",
    annotations: {},
    desc: "empty",
    handler: Function.identity,
  };
}

export function withRequest(request: Request) {
  return Effect.provideService(HttpRequest, request);
}
