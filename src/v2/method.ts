import type { HttpContext, Layer } from "../v2";
import type { Attaches, Passthrough } from "./type-modifiers";

type HttpMethod =
  | "POST"
  | "GET"
  | "PATCH"
  | "PUT"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export function method<
  M extends HttpMethod,
  Context extends Pick<HttpContext, "request">,
  Annotations
>(
  method: M
): Layer<{
  context: Attaches<Context, { method: M }>;
  return: Passthrough<Response>;
  annotation: Attaches<Annotations, { method: M }>;
}> {
  return {
    annotate(annotations, next) {
      return next({ ...annotations, method: method });
    },
    middleware(context, next) {
      if (context.request.method.toUpperCase() === method) {
        return next({ ...context, method });
      }
    },
    tag: `method(${method})`,
  };
}
