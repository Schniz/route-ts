import * as Route from "../src/effectful";
import { test, assert, expect, vitest } from "vitest";
import {
  Effect,
  pipe,
  Option,
  Context,
  Fiber,
  Exit,
  Duration,
  Scope,
} from "../src/effectful/dependencies";
import * as OpenApi from "../src/effectful/openapi";

test(`effectful`, async () => {
  const value = pipe(
    Route.root(),
    Route.method("GET"),
    Route.pathname("/hello/:world"),
    Route.jsonResponse<string>(),
    Route.handleEffect(
      Effect.gen(function* ($) {
        const world = yield* $(Route.PathParam("world"));
        return { body: "Hello from " + world, status: 200, headers: {} };
      })
    ),
    Route.toEffect,
    Route.withRequest(new Request("https://example.com/hello/a")),
    Effect.runSync
  );
  assert(Option.isSome(value));
  assert.equal(await value.value.json(), "Hello from a");
});

test(`match`, async () => {
  type DbId = { readonly _: unique symbol };
  type DbService = { get(): string };
  const Db = Context.Tag<DbId, DbService>();
  const finalizerCalled = vitest.fn();

  const get_hello_param = pipe(
    Route.http(),
    Route.requires(Db),
    Route.method("GET"),
    Route.pathname("/hello/:param1"),
    OpenApi.description("just prints a param coming from the url"),
    Route.handleEffect(
      Effect.gen(function* ($) {
        const db = yield* $(Db);
        const param = yield* $(Route.PathParam("param1"));
        return new Response(`/hello/:param1: ${param}`, {
          headers: {
            "x-db.get": db.get(),
          },
        });
      })
    )
  );

  const route = pipe(
    Route.root(),
    OpenApi.endpoint(),
    Route.provide(Db, { get: () => "from service!" }),
    Route.match((base) => {
      return [
        pipe(
          get_hello_param,
          // read the annotations from base.
          // I wonder how I can make this automatic?
          Route.mergeAnnotations(base),
          OpenApi.register()
        ),
        pipe(
          base,
          Route.method("GET"),
          Route.pathname("/hello/:param1/:param2"),
          OpenApi.register(),
          Route.handleEffect(
            Effect.gen(function* ($) {
              const param1 = yield* $(Route.PathParam("param1"));
              const param2 = yield* $(Route.PathParam("param2"));
              return new Response("/hello/:param1/:param2: " + param1 + param2);
            })
          )
        ),

        pipe(
          base,
          Route.method("POST"),
          Route.handlePromise(async (context) => {
            const url = context.get(Route.HttpUrl);
            return new Response(`POSTed to ${url.pathname}`);
          })
        ),

        pipe(
          base,
          Route.pathname("/long-running"),
          Route.withRequestScope(),
          Route.handleEffect(
            pipe(
              Route.RequestScope,
              Effect.flatMap((scope) =>
                pipe(
                  Effect.gen(function* ($) {
                    yield* $(Effect.sleep(Duration.millis(100)));
                    yield* $(
                      Scope.addFinalizer(scope, Effect.sync(finalizerCalled))
                    );
                    return new Response("waited!");
                  }),
                  Effect.interruptible,
                  Effect.forkIn(scope)
                )
              ),
              Effect.flatMap((fiber) =>
                Effect.gen(function* ($) {
                  const exit = yield* $(Fiber.await(fiber));
                  if (Exit.isInterrupted(exit)) {
                    return new Response("interrupted!");
                  } else if (Exit.isFailure(exit)) {
                    return new Response("failed!");
                  }
                  return exit.value;
                })
              )
            )
          )
        ),
      ];
    }),
    Route.toEffect
  );

  {
    const res = pipe(
      route,
      Route.withRequest(new Request("https://example.com/api/docs")),
      Effect.runSync
    );
    assert(Option.isSome(res));
    assert.deepEqual(await res.value.json(), [
      {
        method: "GET",
        pathname: "/hello/:param1",
        "@openapi/description": "just prints a param coming from the url",
      },
      { method: "GET", pathname: "/hello/:param1/:param2" },
    ]);
  }

  {
    const res = pipe(
      route,
      Route.withRequest(new Request("https://example.com/hello/a/b")),
      Effect.runSync
    );

    assert(Option.isSome(res));
    assert.equal(await res.value.text(), "/hello/:param1/:param2: ab");
  }
  {
    const res = pipe(
      route,
      Route.withRequest(new Request("https://example.com/hello/a")),
      Effect.runSync
    );

    assert(Option.isSome(res));
    assert.equal(await res.value.text(), "/hello/:param1: a");
    assert.equal(res.value.headers.get("x-db.get"), "from service!");
  }
  {
    const res = await pipe(
      route,
      Route.withRequest(
        new Request("https://example.com/literally/anything/goes", {
          method: "POST",
        })
      ),
      Effect.runPromise
    );

    assert(Option.isSome(res));
    assert.equal(await res.value.text(), "POSTed to /literally/anything/goes");
  }

  expect(() =>
    pipe(
      route,
      Route.withRequest(
        new Request("https://example.com/hello/a/b", { method: "POST" })
      ),
      Effect.runSync,
      Option.getOrThrow
    )
  ).toThrow();

  {
    finalizerCalled.mockReset();
    const res = await pipe(
      route,
      Route.withRequest(new Request("https://example.com/long-running")),
      Effect.runPromise
    );

    assert(Option.isSome(res));
    expect(finalizerCalled).not.toHaveBeenCalled();
    assert.equal(await res.value.text(), "waited!");
  }

  {
    finalizerCalled.mockReset();
    const controller = new AbortController();
    const res$ = pipe(
      route,
      Route.withRequest(
        new Request("https://example.com/long-running", {
          signal: controller.signal,
        })
      ),
      Effect.runPromise
    );
    controller.abort();

    const res = await res$;
    assert(Option.isSome(res));
    expect(finalizerCalled).not.toHaveBeenCalled();
    assert.equal(await res.value.text(), "interrupted!");
  }

  {
    finalizerCalled.mockReset();
    const controller = new AbortController();
    const res$ = pipe(
      route,
      Route.withRequest(
        new Request("https://example.com/long-running", {
          signal: controller.signal,
        })
      ),
      Effect.runPromise
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    controller.abort();

    const res = await res$;
    assert(Option.isSome(res));
    assert.equal(await res.value.text(), "interrupted!");
    expect(finalizerCalled).not.toHaveBeenCalled();
  }
});

test("pathname is type safe", () => {
  pipe(
    Route.root(),
    // @ts-expect-error we don't have a "hello" param
    Route.handleEffect(
      Effect.gen(function* ($) {
        yield* $(Route.PathParam("hello"));
        return new Response("hi");
      })
    )
  );
});
