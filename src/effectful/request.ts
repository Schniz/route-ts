import {
  Context,
  Effect,
  pipe,
  Function,
  Scope,
  Exit,
  Fiber,
} from "./dependencies";
import { provideServiceEffect } from "./mapping";
import { Nothing, Route } from "./types";

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

export type ExecutionScopeId = { readonly _: unique symbol };
export const RequestScope = Context.Tag<ExecutionScopeId, Scope.Scope>();

export function withRequestScope() {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout | HttpRequestId, Ein, Eout, Ain, Aout>
  ) => {
    return pipe(
      route,
      provideServiceEffect(
        RequestScope,
        Effect.gen(function* ($) {
          const scope = yield* $(Scope.make());
          const request = yield* $(HttpRequest);
          const lookup = yield* $(
            closeScopeOnAbortSignal(scope, request.signal),
            Effect.forkIn(scope)
          );
          yield* $(Scope.addFinalizer(scope, Fiber.interrupt(lookup)));

          return scope;
        })
      )
    );
  };
}

const closeScopeOnAbortSignal = (
  scope: Scope.CloseableScope,
  signal: AbortSignal
) =>
  Effect.gen(function* ($) {
    yield* $(waitForAbortSignal(signal));
    yield* $(Scope.close(scope, Exit.unit()));
  });

function waitForAbortSignal(signal: AbortSignal) {
  return Effect.asyncInterrupt<never, never, void>((cb) => {
    if (signal.aborted) {
      cb(Effect.unit());
      return Effect.succeed(() => {});
    }

    const abort = () => pipe(Effect.unit(), cb);
    signal.addEventListener("abort", abort);
    return Effect.succeed(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}
