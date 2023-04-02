import assert from "assert";
import { describe, test, expect } from "vitest";

import { router, request, guard, handler, Guard, parseUrl } from "../src";

describe("complex routing", () => {
  const root = router<{ url: URL }>()
    .andThen(request("GET /"))
    .andThen(handler(() => new Response("Hello, from root!")));

  const doesntTypecheck = router<{ unknownDependency: string; url: URL }>()
    .andThen(request("GET /doesnt/typecheck"))
    .andThen(
      handler(async (_req, env) => {
        console.log(env.unknownDependency);
        return new Response("This shouldn't typecheck on the `waterfall` call");
      })
    );

  function provideUnknownDependency<Env>(): Guard<
    Env & { /** this is an unknown dependency */ unknownDependency: string },
    Env
  > {
    return guard((req, env, next) =>
      next(req, { ...env, unknownDependency: "hello!" })
    );
  }

  const doesTypecheck = router<{ url: URL }>()
    .andThen(request("GET /hello/:typecheck/correctly/:spread*"))
    .andThen(provideUnknownDependency())
    .andThen(
      handler(async (req, env) => {
        assert(env.unknownDependency);
        assert(env.path.params.typecheck);
        assert(env.path.params.spread);
        assert(env.method);
        // @ts-ignore
        return Response.json({
          params: env.path.params,
          method: env.method,
          route: env.path.route,
        });
      })
    );

  const app = router()
    .andThen(parseUrl())
    .switches(() => [
      root,
      doesTypecheck,
      // @ts-expect-error this is an example of a route that doesn't typecheck
      doesntTypecheck,
    ]);

  const baseUrl = new URL("https://example.vercel.sh");

  test("root", async () => {
    const req = new Request(new URL("/", baseUrl));
    const response = await app.execute(req, {}, async () => undefined);
    expect(await response?.text()).toEqual(`Hello, from root!`);
  });

  test(`gets path parameters`, async () => {
    const req = new Request(
      new URL("/hello/yeah/correctly/spread/all/the/things", baseUrl)
    );
    const response = await app.execute(req, {}, async () => undefined);
    expect(await response?.json()).toEqual({
      method: "GET",
      route: "/hello/:typecheck/correctly/:spread*",
      params: {
        spread: "spread/all/the/things",
        typecheck: "yeah",
      },
    });
  });
});
