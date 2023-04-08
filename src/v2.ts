import type { Attaches, Passthrough } from "./v2/type-modifiers";

type MaybePromise<T> = T | Promise<T>;
type NextFn<Returns, Env> = (env: Env) => MaybePromise<Returns | undefined>;
type Middleware<ProvidesContext, RequiresContext, Returns, NextReturns> = (
  context: RequiresContext,
  next: NextFn<NextReturns, ProvidesContext>
) => MaybePromise<Returns | undefined>;

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
type Nothing = Record<string, never>;

type InOut<In = any, Out = any> = {
  in: In;
  out: Out;
};

// TODO: consolidate to a single Parser
export type Parser<
  C extends {
    context: InOut;
    return: InOut;
    annotation: InOut;
  }
> = {
  annotate(
    current: C["annotation"]["in"],
    next: NextFn<void, C["annotation"]["out"]>
  ): MaybePromise<void>;
  middleware: Middleware<
    C["context"]["out"],
    C["context"]["in"],
    C["return"]["out"],
    C["return"]["in"]
  >;
  tag?: string;
};

export type HttpContext = {
  /** The incoming request */
  request: Request;

  /** The parsed URL */
  url: URL;
};
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

export function route<Context, Returns, Ann, C2, R2, A2>(
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
