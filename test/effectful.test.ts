import * as Route from "../src/effectful";
import { test, assert, expect } from "vitest";
import { Effect, pipe, Option, Context } from "../src/effectful/dependencies";

test(`effectful`, async () => {
  const value = pipe(
    Route.root(),
    Route.method("GET"),
    Route.pathname("/hello/:world"),
    Route.jsonResponse<string>(),
    Route.handler(
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

  const get_hello_param = pipe(
    Route.http<DbId>(),
    Route.method("GET"),
    Route.pathname("/hello/:param1"),
    Route.handler(
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
    Route.provideServiceEffect(
      Db,
      Effect.succeed({ get: () => "from service!" })
    ),
    Route.match((base) => {
      return [
        get_hello_param,
        pipe(
          base,
          Route.method("GET"),
          Route.pathname("/hello/:param1/:param2"),
          Route.handler(
            Effect.gen(function* ($) {
              const param1 = yield* $(Route.PathParam("param1"));
              const param2 = yield* $(Route.PathParam("param2"));
              return new Response("/hello/:param1/:param2: " + param1 + param2);
            })
          )
        ),
      ];
    }),
    Route.toEffect
  );

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
});
