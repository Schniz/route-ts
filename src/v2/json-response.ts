import type { HttpContext, Layer } from "../v2";
import type { Passthrough } from "./type-modifiers";

export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };

export type JsonResponse = {
  status: number;
  headers: HeadersInit;
  body: Serializable;
};

export function jsonResponse<
  Context extends HttpContext,
  Annotations
>(params?: {
  skipIfHeaderMissing: boolean;
}): Layer<{
  context: Passthrough<Context>;
  return: { out: Response; in: JsonResponse };
  annotation: Passthrough<Annotations>;
}> {
  return {
    annotate: (a, next) => next(a),
    middleware: async (context, next) => {
      if (
        params?.skipIfHeaderMissing &&
        context.request.headers.get("Accept") !== "application/json"
      ) {
        return;
      }

      const response = await next(context);
      if (response) {
        return new Response(JSON.stringify(response.body), {
          status: response.status,
          headers: response.headers,
        });
      }
    },
  };
}
