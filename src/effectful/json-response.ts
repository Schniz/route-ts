import * as Schema from "@effect/schema/Schema";
import * as SchemaAST from "@effect/schema/AST";
import { Option, pipe } from "effect";
import { annotate, described, mappedResponse } from "./mapping";
import {
  OpenApiResponseContentSchemaId,
  OpenApiResponseContentTypeId,
} from "./openapi";
import { Route } from "./types";

export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };

export type JsonResponse<T extends Serializable> = {
  headers: HeadersInit;
  body: T;
  status: number;
};

export function jsonResponse<A extends Serializable>() {
  return <Ann, Rin, Rout, Ein, Eout, Ain>(
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Response>
  ) => {
    return pipe(
      route,
      annotate((current) => ({
        ...current,
        [OpenApiResponseContentTypeId]: "application/json",
      })),
      described("jsonResponse"),
      mappedResponse((res: JsonResponse<A>) => {
        const headers = new Headers(res.headers);
        headers.set("content-type", "application/json");

        return new Response(JSON.stringify(res.body), {
          status: res.status,
          headers,
        });
      })
    );
  };
}

export type JsonResponse2<T> = {
  headers: HeadersInit;
  body: T;
  status: number;
};

export function jsonResponse2<A extends Serializable, From>(
  schema: Schema.Schema<A, From>
) {
  const encode = Schema.encode(schema);
  return <Ann, Rin, Rout, Ein, Eout, Ain>(
    route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Response>
  ) => {
    return pipe(
      route,
      annotate((current) => ({
        ...current,
        [OpenApiResponseContentTypeId]: "application/json",
        [OpenApiResponseContentSchemaId]: pipe(
          SchemaAST.to(schema.ast),
          SchemaAST.getAnnotation(SchemaAST.JSONSchemaAnnotationId),
          Option.getOrElse(() => undefined)
        ),
      })),
      described("jsonResponse"),
      mappedResponse((from: JsonResponse2<From>) => {
        const body = encode(from.body);
        const headers = new Headers(from.headers);
        headers.set("content-type", "application/json");

        return new Response(JSON.stringify(body), {
          status: from.status,
          headers,
        });
      })
    );
  };
}
