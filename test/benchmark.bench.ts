import { bench, expect, type BenchFunction } from "vitest";
import * as R from "../src";
import Trouter from "trouter";

const request = new Request("http://localhost/hello/world/foo");

bench(
  "trouter",
  ((): BenchFunction => {
    const router = new Trouter<(params: any) => Response>();
    router
      .get("/hello/:world", () => new Response("world"))
      .get("/hello", () => new Response("hello"))
      .get(
        "/hello/:world/:foo",
        (params) => new Response(`${params.world}, ${params.foo}`)
      );

    return async () => {
      const { pathname } = new URL(request.url);
      const obj = router.find(request.method.toUpperCase() as any, pathname);
      const response = obj.handlers[0](obj.params);
      await expect(response.text()).resolves.toBe("world, foo");
    };
  })()
);

bench("baseline (parsing URL & generating a response)", async () => {
  new URL(request.url);
  const response = new Response("world, foo");
  await expect(response?.text()).resolves.toBe("world, foo");
});

bench(
  "path based routing",
  ((): BenchFunction => {
    const router = new R.Chain(R.http<Record<never, never>>()).match((prev) => {
      return [
        R.continues(prev)
          .with(R.method("GET"))
          .with(R.pathname("/hello/:world"))
          .handler(async (c) => new Response(c.path.params.world)),
        R.continues(prev)
          .with(R.method("GET"))
          .with(R.pathname("/hello"))
          .handler(async () => new Response("hello")),
        R.continues(prev)
          .with(R.method("GET"))
          .with(R.pathname("/hello/:world/:foo"))
          .handler(
            async (c) =>
              new Response(c.path.params.world + ", " + c.path.params.foo)
          ),
      ];
    });
    return async () => {
      const response = await router.middleware({ request }, () => undefined);
      await expect(response?.text()).resolves.toBe("world, foo");
    };
  })()
);
