import { Route } from "./types";
import { Context, Effect, ReadonlyArray, ReadonlyRecord, pipe } from "effect";
import { HttpUrlId } from "./request";
import { Method } from "./method";
import { annotate, provideServiceEffect } from "./mapping";
import { OpenAPIV3 } from "openapi-types";

type RouteDefinition = {
  pathname: string;
  method: string;
  [OpenApiDescriptionId]?: string;
  [OpenApiResponseContentTypeId]?: string;
  [OpenApiResponseContentSchemaId]?: OpenAPIV3.SchemaObject;
};

export const OpenApiDescriptionId = "@openapi/description" as const;
export const OpenApiResponseContentTypeId =
  "@openapi/response-content-type" as const;
export const OpenApiResponseContentSchemaId =
  "@openapi/response-content-schema" as const;
const RegisterRouteId = Symbol.for("@openapi/register-route-fn");
type RegisterRouteFn = (annotations: RouteDefinition) => void;

export type OpenApiSchemaId = { readonly _: unique symbol };
export type OpenApiSchemaService = { build(): OpenAPIV3.Document };
export const OpenApiSchema = Context.Tag<
  OpenApiSchemaId,
  OpenApiSchemaService
>();

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

export function builder(params: { info: OpenAPIV3.InfoObject }) {
  return <Ann, Rin, Rout, Ein, Eout, Ain>(
    route: Route<Ann, Rin, Rout | HttpUrlId, Ein, Eout, Ain, Response>
  ) => {
    const endpoints: RouteDefinition[] = [];
    const registerEndpoint: RegisterRouteFn = (
      routeDefinition: RouteDefinition
    ) => {
      endpoints.push(routeDefinition);
    };

    return pipe(
      route,
      annotate((current) => ({
        ...current,
        [RegisterRouteId]: registerEndpoint,
      })),
      provideServiceEffect(
        OpenApiSchema,
        Effect.succeed({
          build: () => buildOpenApiSchema({ endpoints, info: params.info }),
        })
      )
    );
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

function buildOpenApiSchema(params: {
  endpoints: RouteDefinition[];
  info: OpenAPIV3.InfoObject;
}): OpenAPIV3.Document {
  return {
    openapi: "3.0.0",
    info: params.info,
    paths: !ReadonlyArray.isNonEmptyArray(params.endpoints)
      ? {}
      : pipe(
          params.endpoints,
          ReadonlyArray.groupWith((a, b) => a.pathname === b.pathname),
          ReadonlyArray.map((defs): [string, OpenAPIV3.PathItemObject] => [
            convertPathnameIntoOpenApiEquivalent(defs[0].pathname),
            pipe(
              defs,
              ReadonlyArray.map(
                (def): [string, OpenAPIV3.PathItemObject["get"]] => [
                  def.method.toLowerCase(),
                  {
                    description: def[OpenApiDescriptionId],
                    parameters: pipe(
                      extractParameterNamesFromPathname(def.pathname),
                      ReadonlyArray.map(
                        (name): OpenAPIV3.ParameterObject => ({
                          name,
                          in: "path",
                          required: true,
                          schema: {
                            type: "string",
                          },
                        })
                      )
                    ),
                    responses: {
                      200: {
                        description: "Success",
                        content: {
                          ...(def[OpenApiResponseContentTypeId] && {
                            [def[OpenApiResponseContentTypeId]]: {
                              ...(def[OpenApiResponseContentSchemaId] && {
                                schema: def[OpenApiResponseContentSchemaId],
                              }),
                            },
                          }),
                        },
                      },
                    },
                  },
                ]
              ),
              ReadonlyRecord.fromEntries
            ),
          ]),
          ReadonlyRecord.fromEntries
        ),
  };
}

function convertPathnameIntoOpenApiEquivalent(pathname: string) {
  return pathname
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        return `{${part.slice(1)}}`;
      }
      return part;
    })
    .join("/");
}

function extractParameterNamesFromPathname(pathname: string) {
  return pathname
    .split("/")
    .filter((part) => part.startsWith(":"))
    .map((part) => part.slice(1));
}
