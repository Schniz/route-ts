import * as Effect from "@effect/io/Effect";
// import { Passthrough } from "../dist";
import { pipe } from "@effect/data/Function";
import * as Option from "@effect/data/Option";
import { Tag } from "@effect/data/Context";

// type NextFn<Context, Return> = (ctx: Context) => Return;
// type Handler<Context, NextFnContext, Return, NextFnReturn> = (
//   ctx: Context,
//   next: NextFn<NextFnContext, NextFnReturn>
// ) => Return;

// type Route<Annotations, Context, NextFnContext, Return, NextFnReturn, E, R> = {
//   _tag: "route.ts";
//   desc: string;
//   handler: (
//     context: Context,
//     next: (
//       context: NextFnContext
//     ) => Effect.Effect<R, E, Option.Option<NextFnReturn>>
//   ) => Effect.Effect<R, E, Option.Option<Return>>;
//   annotations: Annotations;
// };
type Route<Annotations, Rin, Rout, Ein, Eout, Ain, Aout> = {
  _tag: "route.ts";
  desc: string;
  handler: (
    next: Effect.Effect<Rout, Eout, Option.Option<Aout>>
  ) => Effect.Effect<Rin, Ein, Option.Option<Ain>>;
  annotations: Annotations;
};
type Nothing = Record<never, never>;

type HttpRequestId = { readonly "@route-ts/request": unique symbol };
const HttpRequest = Tag<HttpRequestId, Request>();

type HttpUrlId = { readonly "@route-ts/url": unique symbol };
const HttpUrl = Tag<HttpUrlId, URL>();

type PathParamId<ParamName> = {
  readonly _: unique symbol;
  readonly "@route-ts/path-param": ParamName;
};
const PathParam = <ParamName extends string>(paramName: ParamName) =>
  Tag<PathParamId<ParamName>, string>(`@route-ts/param/${paramName}`);
type PathnameId = { readonly "@route-ts/pathname": unique symbol };
const Pathname = Tag<PathnameId, string>();

function http<Rin>(): Route<
  Nothing,
  Rin | HttpRequestId,
  Rin | HttpRequestId | HttpUrlId,
  never,
  never,
  Response,
  Response
> {
  return {
    _tag: "route.ts",
    annotations: {},
    desc: "http",
    handler: (next) =>
      pipe(
        next,
        Effect.provideServiceEffect(
          HttpUrl,
          pipe(
            HttpRequest,
            Effect.map((request) => new URL(request.url))
          )
        )
      ),
  };
}

type HttpMethodId = { readonly "@route-ts/method": unique symbol };
const HttpMethod = Tag<HttpMethodId, string>();

function method<M extends string>(method: M) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout | HttpRequestId, Ein, Eout, Ain, Aout>
  ): Route<
    Ann & { method: M },
    Rin,
    Rout | HttpRequestId | HttpMethodId,
    Ein,
    Eout,
    Ain,
    Aout
  > => {
    return {
      _tag: "route.ts",
      annotations: { ...route.annotations, method },
      desc: `${route.desc} -> method(${method})`,
      handler: (next) =>
        route.handler(
          Effect.gen(function* (_) {
            const request = yield* _(HttpRequest);
            if (request.method === method) {
              return yield* _(next, Effect.provideService(HttpMethod, method));
            }
            return Option.none();
          })
        ),
    };
  };
}

// function http<Context = Nothing>(): Route<
//   Nothing,
//   Context & { request: Request },
//   Context & { request: Request; url: URL },
//   Response,
//   Response,
//   never,
//   never
// > {
//   return {
//     _tag: "route.ts",
//     annotations: {},
//     desc: "http",
//     handler: (context, next) => {
//       return next({ ...context, url: new URL(context.request.url) });
//     },
//   };
// }

// function method<M extends string>(method: M) {
//   return <
//     Annotations,
//     Context,
//     NextFnContext extends { request: Request },
//     Return,
//     NextFnReturn,
//     E,
//     R
//   >(
//     route: Route<
//       Annotations,
//       Context,
//       NextFnContext,
//       Return,
//       NextFnReturn,
//       E,
//       R
//     >
//   ): Route<
//     Annotations & { method: M },
//     Context,
//     NextFnContext & { method: M },
//     Return,
//     NextFnReturn,
//     E,
//     R
//   > => {
//     return {
//       _tag: "route.ts",
//       annotations: { ...route.annotations, method },
//       desc: `${route.desc} -> method(${method})`,
//       handler: (context, next) => {
//         return route.handler(context, (ctx) => {
//           if (ctx.request.method === method) {
//             return next({ ...ctx, method });
//           }
//           return Effect.succeed(Option.none());
//         });
//       },
//     };
//   };
// }

// function handler<Context, R, E, A>(
//   handler: (context: Context) => Effect.Effect<R, E, A>
// ) {
//   return <Annotations, PrevContext, PrevReturn>(
//     route: Route<Annotations, PrevContext, Context, PrevReturn, A, E, R>
//   ): Route<Annotations, PrevContext, never, PrevReturn, never, E, R> => {
//     return {
//       _tag: "route.ts",
//       annotations: route.annotations,
//       desc: `${route.desc} -> handler`,
//       handler: (context, _next) => {
//         return route.handler(context, (context) => {
//           return pipe(handler(context), Effect.map(Option.some));
//         });
//       },
//     };
//   };
// }

// type JsonResponse<T> = {
//   headers: HeadersInit;
//   body: T;
//   status: number;
// };

// function jsonResponse<Payload>() {
//   return <Annotations, PrevContext, Context, PrevReturn, E, R>(
//     route: Route<Annotations, PrevContext, Context, PrevReturn, Response, E, R>
//   ): Route<
//     Annotations,
//     PrevContext,
//     Context,
//     PrevReturn,
//     JsonResponse<Payload>,
//     E,
//     R
//   > => {
//     return {
//       _tag: "route.ts",
//       annotations: route.annotations,
//       desc: `${route.desc} -> jsonResponse`,
//       handler: (context, next) => {
//         return route.handler(context, (context) => {
//           return pipe(
//             next(context),
//             Effect.map(
//               Option.map((response) => {
//                 return new Response(JSON.stringify(response.body), {
//                   headers: {
//                     "content-type": "application/json",
//                     ...response.headers,
//                   },
//                   status: response.status,
//                 });
//               })
//             )
//           );
//         });
//       },
//     };
//   };
// }

type NormalizeParam<T extends string> = T extends `${infer Prefix}*`
  ? [Prefix, string]
  : [T, string];

type ParamsFromPath<Pathname extends string> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Pathname extends `${infer _}:${infer Param}/${infer Rest}`
    ? { [K in NormalizeParam<Param> as K[0]]: K[1] } & ParamsFromPath<Rest>
    : // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Pathname extends `${infer _}:${infer Param}`
    ? { [K in NormalizeParam<Param> as K[0]]: K[1] }
    : Record<never, never>;

function pathname<Pathname extends string>(pathname: Pathname) {
  return <Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
    route: Route<Ann, Rin, Rout | HttpRequestId, Ein, Eout, Ain, Aout>
  ): Route<
    Ann & { pathname: Pathname },
    Rin,
    Rout | HttpRequestId | PathnameId | PathParamId<"hello">,
    Ein,
    Eout,
    Ain,
    Aout
  > => {
    return {
      _tag: "route.ts",
      annotations: { ...route.annotations, pathname },
      desc: `${route.desc} -> method(${method})`,
      handler: (next) =>
        route.handler(
          Effect.gen(function* (_) {
            const request = yield* _(HttpRequest);
            if (request.method === pathname) {
              return yield* _(
                next,
                Effect.provideService(Pathname, pathname),
                Effect.provideService(PathParam("hello"), "world")
              );
            }
            return Option.none();
          })
        ),
    };
  };
}

function handler<R, E, A>(effect: Effect.Effect<R, E, A>) {
  return <Ann, Rin, Ein, Ain>(
    route: Route<Ann, Rin, R, Ein, E, Ain, A>
  ): Route<Ann, Rin, never, Ein, never, Ain, never> => {
    return {
      _tag: "route.ts",
      annotations: route.annotations,
      desc: "handler",
      handler: () => {
        return pipe(effect, Effect.map(Option.some), route.handler);
      },
    };
  };
}

const a = pipe(
  http(),
  method("GET")
  // pathname("/hello/:world"),
  // jsonResponse<{ hello: string }>(),
  // handler(
  //   Effect.gen(function* (_) {
  //     const param = yield* _(PathParam("hellos"));
  //     return new Response("hi!");
  //   })
  // )
);
