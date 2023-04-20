import type { HttpContext, Layer } from "../v2";
import type { Attaches, Passthrough } from "./type-modifiers";

export type OpenApiAnnotationProvider = {
  registerOpenApi: (data: { method: string; path: string }) => void;
};

export type OpenApiRequirements = OpenApiAnnotationProvider & {
  method: string;
  path: string;
};
export function openApi<Context extends HttpContext, Ann>(): Layer<{
  annotation: Attaches<Ann, OpenApiAnnotationProvider>;
  context: Passthrough<Context>;
  return: Passthrough<Response>;
}> {
  const routes = [] as any[];
  const registerOpenApi = (data: { method: string; path: string }) => {
    const path = data.path.replace(/\/:([^\/]+)/g, "/{$1}");
    routes.push({
      ...data,
      path,
    });
  };
  return {
    annotate: (a, next) => next({ ...a, registerOpenApi }),
    middleware: (context, next) => {
      if (context.url.pathname === "/openapi.json") {
        return new Response(
          JSON.stringify({
            routes,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }

      return next(context);
    },
  };
}

export function registerOpenApi<
  Context,
  Returns,
  Ann extends OpenApiRequirements
>(): Layer<{
  annotation: Passthrough<Ann>;
  context: Passthrough<Context>;
  return: Passthrough<Returns>;
}> {
  return {
    annotate: (a, next) => {
      a.registerOpenApi({ method: a.method, path: a.path });
      return next(a);
    },
    middleware: (context, next) => next(context),
  };
}
