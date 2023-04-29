import { pipe } from "./dependencies";
import { described, mappedResponse } from "./mapping";
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
