import type { Attaches, Passthrough } from "./v2/type-modifiers";

/**
 * Either T or a promise of T.
 * @template T the type of the value
 */
type MaybePromise<T> = T | Promise<T>;

/**
 * A function that takes an input and returns a value which may be a promise.
 *
 * @template Returns the type of the return value
 * @template Env the input type
 */
type NextFn<Returns, Env> = (env: Env) => MaybePromise<Returns | undefined>;
type Middleware<ProvidesContext, RequiresContext, Returns, NextReturns> = (
  context: RequiresContext,
  next: NextFn<NextReturns, ProvidesContext>
) => MaybePromise<Returns | undefined>;

/**
 * A flat representation of {@link Parser}.
 */
type FlatParser<
  ProvidesContext,
  RequiresContext,
  Returns,
  NextReturns,
  ProvidesAnnotation,
  RequiresAnnotation
> = Parser<{
  context: { in: RequiresContext; out: ProvidesContext };
  return: { in: NextReturns; out: Returns };
  annotation: { in: RequiresAnnotation; out: ProvidesAnnotation };
}>;

/**
 * An empty object
 */
type Nothing = Record<string, never>;

type InOut<In = any, Out = any> = {
  in: In;
  out: Out;
};

/**
 * a Parser is a structure that parses and optionally forwards a request.
 */
export type Parser<
  Config extends {
    /**
     * The input/output context
     */
    context: InOut;
    /**
     * The input/output return value
     * The output would be whatever the previous parser expects as input.
     * The input would be what the next parser expects as output, or: what the {@link NextFn} middleware function will return.
     */
    return: InOut;
    /**
     * The input/output annotation
     */
    annotation: InOut;
  }
> = {
  /**
   * Annotate the request with some data.
   * This takes the parser input annotation and forwards using the `next` function
   * the output annotation.
   */
  annotate(
    current: Config["annotation"]["in"],
    next: NextFn<void, Config["annotation"]["out"]>
  ): MaybePromise<void>;
  /**
   * The middleware function that will be called by the router.
   * This takes the parser input context and forwards using the `next` function
   * the output context.
   */
  middleware: Middleware<
    Config["context"]["out"],
    Config["context"]["in"],
    Config["return"]["out"],
    Config["return"]["in"]
  >;
  /**
   * A tag to identify the parser. This is useful for debugging.
   */
  tag?: string;
};

export type HttpContext = {
  /** The incoming request */
  request: Request;

  /** The parsed URL */
  url: URL;
};

/**
 * Start an http routing.
 * Adds a `url` property to the context.
 *
 * @template Context an input context that the router expects. Omitting it will default to a { request } object.
 */
export function http<Context = Nothing>(): Parser<{
  context: Attaches<Context & { request: Request }, { url: URL }>;
  return: Passthrough<Response>;
  annotation: Passthrough<Nothing>;
}> {
  return {
    middleware(context, next) {
      return next({ ...context, url: new URL(context.request.url) });
    },
    annotate(annotations, next) {
      return next(annotations);
    },
    tag: "http",
  };
}

export type ParserConfig<T> = T extends FlatParser<
  infer ProvidesContext,
  infer RequiresContext,
  infer Returns,
  infer NextReturns,
  infer ProvidesAnnotation,
  infer RequiresAnnotation
>
  ? {
      context: { in: RequiresContext; out: ProvidesContext };
      return: { in: NextReturns; out: Returns };
      annotation: { in: RequiresAnnotation; out: ProvidesAnnotation };
    }
  : never;

export class Chain<
  ProvidesContext,
  RequiresContext,
  Returns,
  NextReturns,
  ProvidesAnnotation,
  RequiresAnnotation
> implements
    FlatParser<
      ProvidesContext,
      RequiresContext,
      Returns,
      NextReturns,
      ProvidesAnnotation,
      RequiresAnnotation
    >
{
  constructor(
    private readonly parser: FlatParser<
      ProvidesContext,
      RequiresContext,
      Returns,
      NextReturns,
      ProvidesAnnotation,
      RequiresAnnotation
    >
  ) {}

  annotate(
    annotations: RequiresAnnotation,
    next: NextFn<void, ProvidesAnnotation>
  ): MaybePromise<void> {
    return this.parser.annotate(annotations, next);
  }
  get middleware(): Middleware<
    ProvidesContext,
    RequiresContext,
    Returns,
    NextReturns
  > {
    return this.parser.middleware;
  }

  prettifyGenerics(): Chain<
    { [key in keyof ProvidesContext]: ProvidesContext[key] },
    { [key in keyof RequiresContext]: RequiresContext[key] },
    Returns,
    NextReturns,
    { [key in keyof ProvidesAnnotation]: ProvidesAnnotation[key] },
    { [key in keyof RequiresAnnotation]: RequiresAnnotation[key] }
  > {
    return this as any;
  }

  with<ProvidesContext2, ProvidesAnnotation2, NextReturns2>(
    fn:
      | FlatParser<
          ProvidesContext2,
          ProvidesContext,
          NextReturns,
          NextReturns2,
          ProvidesAnnotation2,
          ProvidesAnnotation
        >
      | ((
          parser: FlatParser<
            ProvidesContext,
            RequiresContext,
            Returns,
            NextReturns,
            ProvidesAnnotation,
            RequiresAnnotation
          >
        ) => FlatParser<
          ProvidesContext2,
          ProvidesContext,
          NextReturns,
          NextReturns2,
          ProvidesAnnotation2,
          ProvidesAnnotation
        >)
  ): Chain<
    ProvidesContext2,
    RequiresContext,
    Returns,
    NextReturns2,
    ProvidesAnnotation2,
    RequiresAnnotation
  > {
    const nextParser = typeof fn === "function" ? fn(this.parser) : fn;
    return new Chain<
      ProvidesContext2,
      RequiresContext,
      Returns,
      NextReturns2,
      ProvidesAnnotation2,
      RequiresAnnotation
    >({
      annotate: async (annotations, next) => {
        return this.parser.annotate(annotations, async (annotations) => {
          return nextParser.annotate(annotations, next);
        });
      },
      middleware: async (context, next) => {
        const v = await this.parser.middleware(context, async (context) => {
          return nextParser.middleware(context, next);
        });
        return v;
      },
    });
  }

  handler(
    fn: (context: ProvidesContext) => Promise<NextReturns>
  ): FlatParser<
    ProvidesContext,
    RequiresContext,
    Returns,
    NextReturns,
    ProvidesAnnotation,
    RequiresAnnotation
  > {
    return {
      annotate: this.parser.annotate,
      middleware: async (context) => {
        return this.parser.middleware(context, (c) => {
          return fn(c);
        });
      },
    };
  }

  match<
    P extends FlatParser<
      any,
      ProvidesContext,
      NextReturns,
      any,
      any,
      ProvidesAnnotation
    >
  >(
    fn: (
      parser: FlatParser<
        ProvidesContext,
        RequiresContext,
        Returns,
        NextReturns,
        ProvidesAnnotation,
        RequiresAnnotation
      >
    ) => P[]
  ): Chain<
    ParserConfig<P>["context"]["out"],
    RequiresContext,
    Returns,
    ParserConfig<P>["return"]["in"],
    ParserConfig<P>["annotation"]["out"],
    RequiresAnnotation
  > {
    const parsers = typeof fn === "function" ? fn(this.parser) : fn;

    return new Chain<
      ParserConfig<P>["context"]["out"],
      RequiresContext,
      Returns,
      ParserConfig<P>["return"]["in"],
      ProvidesAnnotation,
      RequiresAnnotation
    >({
      annotate: async (annotations, next) => {
        return this.parser.annotate(annotations, async (annotations) => {
          for (const parser of parsers) {
            await parser.annotate(annotations, next);
          }
        });
      },
      middleware: async (context, next) => {
        return this.parser.middleware(context, async (context) => {
          for (const parser of parsers) {
            const result = await parser.middleware(context, next);
            if (result) {
              return result;
            }
          }
        });
      },
    });
  }
}

/**
 * Infer a router that depends on a previous router.
 * This is handy when `match`ing, as you want to _continue_
 * the previous route definition.
 *
 * It is basically to make TypeScript infer better.
 */
export function continues<Context, Returns, Ann, C2, R2, A2>(
  _from?: Parser<{
    annotation: { in: A2; out: Ann };
    context: { in: C2; out: Context };
    return: { in: Returns; out: R2 };
  }>
) {
  return new Chain<Context, Context, Returns, Returns, Ann, Ann>({
    annotate: (a, next) => next(a),
    middleware: (context, next) => next(context),
  });
}

// TODO: this can be cool
// export declare function createRoutingPaths<P extends Parser<any>>(): (
//   path: ParserConfig<P>["annotation"]["out"] extends infer R
//     ? R extends { path: string; method: string }
//       ? {
//           [Obj in R as Obj["path"]]: "GET" extends Obj["method"]
//             ? Obj["path"]
//             : never;
//         }[R["path"]]
//       : never
//     : never
// ) => string;
