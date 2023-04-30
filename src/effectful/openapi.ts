import { Route } from "./types";
import { Effect, Option, pipe } from "./dependencies";
import { HttpUrl, HttpUrlId } from "./request";
import { Method } from "./method";
import { annotate } from "./mapping";

type RouteDefinition = {
  pathname: string;
  method: string;
  [OpenApiDescriptionId]?: string;
};

const OpenApiDescriptionId = "@openapi/description" as const;
const RegisterRouteId = Symbol.for("@openapi/register-route-fn");
type RegisterRouteFn = (annotations: RouteDefinition) => void;

export function description(desc: string) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
  ) => {
    return pipe(
      route,
      annotate((current) => ({ ...current, [OpenApiDescriptionId]: desc }))
    );
  };
}

export function endpoint() {
  return <Ann, Rin, Rout, Ein, Eout, Ain>(
    route: Route<Ann, Rin, Rout | HttpUrlId, Ein, Eout, Ain, Response>
  ): Route<
    Ann & { [RegisterRouteId]: RegisterRouteFn },
    Rin,
    Rout | HttpUrlId,
    Ein,
    Eout,
    Ain,
    Response
  > => {
    const endpoints: RouteDefinition[] = [];
    const registerEndpoint: RegisterRouteFn = (
      routeDefinition: RouteDefinition
    ) => {
      endpoints.push(routeDefinition);
    };

    return {
      ...route,
      annotations: {
        ...route.annotations,
        [RegisterRouteId]: registerEndpoint,
      },
      handler: (next) =>
        route.handler(
          Effect.gen(function* ($) {
            const url = yield* $(HttpUrl);
            if (url.pathname === "/api/docs") {
              return Option.some(
                new Response(JSON.stringify(endpoints), {
                  headers: { "content-type": "application/json" },
                })
              );
            }
            return yield* $(next);
          })
        ),
    };
  };
}

export function register() {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<
      Ann & {
        [RegisterRouteId]: RegisterRouteFn;
        method: Method;
        pathname: string;
      },
      Rin,
      Rout,
      Ein,
      Eout,
      Ain,
      Aout
    >
  ): typeof route => {
    route.annotations[RegisterRouteId](route.annotations);

    return route;
  };
}
