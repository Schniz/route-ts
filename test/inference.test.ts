import { test, expectTypeOf, describe } from "vitest";
import * as R from "../src";
import { NextFn } from "../src/v2";
import { effectful } from "../src/v2/effectful";

describe("http()", () => {
  test("expects a Response value from handler", () => {
    const chain = new R.Chain(R.http());
    const expectHandlerResult = expectTypeOf(chain.handler).parameter(0).returns
      .resolves;
    expectHandlerResult.toEqualTypeOf<Response>();
    expectHandlerResult.not.toBeAny();
  });
});

describe("jsonResponse()", () => {
  test("expects a serialized response from handler", () => {
    const chain = new R.Chain(R.http()).with(R.jsonResponse());
    const expectHandlerResult = expectTypeOf(chain.handler).parameter(0).returns
      .resolves;
    expectHandlerResult.toEqualTypeOf<R.JsonResponse>();
    expectHandlerResult.not.toBeAny();
  });
});

describe("pathname()", () => {
  test("parses path params and puts them into the handler context", () => {
    const chain = new R.Chain(R.http())
      .with(R.pathname("/hello/:name"))
      .prettifyGenerics();
    const expectHandlerResult = expectTypeOf(chain.handler)
      .parameter(0)
      .parameter(0);
    expectHandlerResult.toMatchTypeOf<{
      path: { route: "/hello/:name"; params: { name: string } };
      request: Request;
      url: URL;
    }>();
    expectHandlerResult.not.toBeAny();
  });

  test("annotates the parser with the path", () => {
    new R.Chain(R.http())
      .with(R.pathname("/hello/:name"))
      .annotate({}, (annotations) => {
        expectTypeOf(annotations).toMatchTypeOf<{
          path: "/hello/:name";
        }>();
      });
  });
});

describe("method()", () => {
  test("parses the method and puts it on the handler context", () => {
    const chain = new R.Chain(R.http()).with(R.method("POST"));
    const expectHandlerResult = expectTypeOf(chain.handler)
      .parameter(0)
      .parameter(0);
    expectHandlerResult.not.toBeAny();
    expectHandlerResult.toMatchTypeOf<{
      method: "POST";
    }>();
  });

  test("annotates the parser with the method", () => {
    new R.Chain(R.http()).with(R.method("POST")).annotate({}, (annotations) => {
      expectTypeOf(annotations).toMatchTypeOf<{
        method: "POST";
      }>();
    });
  });
});

import * as Effect from "@effect/io/Effect";
import * as Logger from "@effect/io/Logger";
describe("effectful()", () => {
  test("expects an Effect value from handler", () => {
    const chain = new R.Chain(R.http()).with(effectful());
    const expectHandlerResult = expectTypeOf(chain.handler).parameter(0).returns
      .resolves;
    expectHandlerResult.not.toBeAny();
    expectHandlerResult.toEqualTypeOf<Effect.Effect<never, never, Response>>();
  });
});
