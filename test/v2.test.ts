import { Chain, http, route, ParserConfig } from "../src/v2";
import { method } from "../src/v2/method";
import { pathname } from "../src/v2/pathname";
import { jsonResponse } from "../src/v2/json-response";
import { expect, test, expectTypeOf } from "vitest";
import {
  openApi,
  OpenApiAnnotationProvider,
  registerOpenApi,
} from "../src/v2/openapi";

const c = new Chain(http<{ hello: "world" }>())
  .with(openApi())
  .match((from) => {
    return [
      route(from)
        .with(method("GET"))
        .with(pathname("/hello/:param"))
        .handler(async (context) => {
          return new Response(
            "Hello from " + JSON.stringify(context.path.params)
          );
        }),
      route(from)
        .with(method("POST"))
        .with(pathname("/hello/:param"))
        .with(jsonResponse())
        .handler(async (context) => {
          return {
            body: { params: context.path.params },
            status: 200,
            headers: {},
          };
        }),
      route(from)
        .with(method("PUT"))
        .with(pathname("/another/route"))
        .handler(async (_context) => {
          return new Response("another route!");
        }),
    ];
  })
  .with(registerOpenApi())
  .prettifyGenerics();

const with404 = new Chain(http<{ hello: "world" }>()).match((from) => {
  return [
    route(from).with(c),
    route(from).handler(async () => {
      return new Response("Not found", { status: 404 });
    }),
  ];
});

test("types", () => {
  type PConfig = ParserConfig<typeof c>;

  expectTypeOf<PConfig["annotation"]["out"]>().toMatchTypeOf<
    OpenApiAnnotationProvider &
      (
        | {
            method: "POST";
            path: "/hello/:param";
          }
        | {
            method: "GET";
            path: "/hello/:param";
          }
        | {
            method: "PUT";
            path: "/another/route";
          }
      )
  >();
});

test("test", async () => {
  await c.annotate({}, () => {});

  {
    const request = new Request("https://example.vercel.sh/hello/world");
    const response = await c.middleware(
      { request, hello: "world" },
      () => undefined
    );
    expect(await response?.text()).toEqual(`Hello from {"param":"world"}`);
  }

  {
    const request = new Request("https://example.vercel.sh/hello/world", {
      method: "DELETE",
    });
    const response = await c.middleware(
      { request, hello: "world" },
      () => undefined
    );
    expect(response).toBeUndefined();
  }

  {
    // returns 404
    const request = new Request("https://example.vercel.sh/hello/world", {
      method: "DELETE",
    });
    const response = await with404.middleware(
      { request, hello: "world" },
      () => undefined
    );
    expect(response?.status).toEqual(404);
  }

  {
    const request = new Request("https://example.vercel.sh/openapi.json");
    const response = await c.middleware(
      { request, hello: "world" },
      () => undefined
    );
    expect(await response?.json()).toEqual({
      routes: [
        {
          method: "GET",
          path: "/hello/{param}",
        },
        {
          method: "POST",
          path: "/hello/{param}",
        },
        {
          method: "PUT",
          path: "/another/route",
        },
      ],
    });
  }
});
