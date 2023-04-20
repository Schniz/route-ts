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
 * A flat representation of {@link Layer}.
 */
type FlatLayer<
  ProvidesContext,
  RequiresContext,
  Returns,
  NextReturns,
  ProvidesAnnotation,
  RequiresAnnotation
> = Layer<{
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
 * a Layer is a structure that parses and optionally forwards a request.
 */
export type Layer<
  Config extends {
    /**
     * The input/output context
     */
    context: InOut;
    /**
     * The input/output return value
     * The output would be whatever the previous layer expects as input.
     * The input would be what the next layer expects as output, or: what the {@link NextFn} middleware function will return.
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
   * This takes the layer input annotation and forwards using the `next` function
   * the output annotation.
   */
  annotate(
    current: Config["annotation"]["in"],
    next: NextFn<void, Config["annotation"]["out"]>
  ): MaybePromise<void>;
  /**
   * The middleware function that will be called by the router.
   * This takes the layer input context and forwards using the `next` function
   * the output context.
   */
  middleware: Middleware<
    Config["context"]["out"],
    Config["context"]["in"],
    Config["return"]["out"],
    Config["return"]["in"]
  >;
  /**
   * A tag to identify the layer. This is useful for debugging.
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
export function http<Context = Nothing>(): Layer<{
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

export type LayerConfig<T> = T extends FlatLayer<
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
    FlatLayer<
      ProvidesContext,
      RequiresContext,
      Returns,
      NextReturns,
      ProvidesAnnotation,
      RequiresAnnotation
    >
{
  constructor(
    private readonly layer: FlatLayer<
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
    return this.layer.annotate(annotations, next);
  }
  get middleware(): Middleware<
    ProvidesContext,
    RequiresContext,
    Returns,
    NextReturns
  > {
    return this.layer.middleware;
  }

  get tag(): string | undefined {
    return this.layer.tag;
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
      | FlatLayer<
          ProvidesContext2,
          ProvidesContext,
          NextReturns,
          NextReturns2,
          ProvidesAnnotation2,
          ProvidesAnnotation
        >
      | ((
          layer: FlatLayer<
            ProvidesContext,
            RequiresContext,
            Returns,
            NextReturns,
            ProvidesAnnotation,
            RequiresAnnotation
          >
        ) => FlatLayer<
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
    const nextLayer = typeof fn === "function" ? fn(this.layer) : fn;
    return new Chain<
      ProvidesContext2,
      RequiresContext,
      Returns,
      NextReturns2,
      ProvidesAnnotation2,
      RequiresAnnotation
    >({
      annotate: async (annotations, next) => {
        return this.layer.annotate(annotations, async (annotations) => {
          return nextLayer.annotate(annotations, next);
        });
      },
      middleware: async (context, next) => {
        const v = await this.layer.middleware(context, async (context) => {
          return nextLayer.middleware(context, next);
        });
        return v;
      },
      tag: [this.layer.tag, nextLayer.tag].filter(Boolean).join(" -> "),
    });
  }

  handler(
    fn: (context: ProvidesContext) => Promise<NextReturns>
  ): FlatLayer<
    ProvidesContext,
    RequiresContext,
    Returns,
    NextReturns,
    ProvidesAnnotation,
    RequiresAnnotation
  > {
    return {
      annotate: this.layer.annotate,
      middleware: async (context) => {
        return this.layer.middleware(context, (c) => {
          return fn(c);
        });
      },
      tag: [this.layer.tag, "!"].filter(Boolean).join(" -> "),
    };
  }

  match<
    P extends FlatLayer<
      any,
      ProvidesContext,
      NextReturns,
      any,
      any,
      ProvidesAnnotation
    >
  >(
    fn: (
      layer: FlatLayer<
        ProvidesContext,
        RequiresContext,
        Returns,
        NextReturns,
        ProvidesAnnotation,
        RequiresAnnotation
      >
    ) => P[]
  ): Chain<
    LayerConfig<P>["context"]["out"],
    RequiresContext,
    Returns,
    LayerConfig<P>["return"]["in"],
    LayerConfig<P>["annotation"]["out"],
    RequiresAnnotation
  > {
    const layers = typeof fn === "function" ? fn(this.layer) : fn;

    return new Chain<
      LayerConfig<P>["context"]["out"],
      RequiresContext,
      Returns,
      LayerConfig<P>["return"]["in"],
      ProvidesAnnotation,
      RequiresAnnotation
    >({
      annotate: async (annotations, next) => {
        return this.layer.annotate(annotations, async (annotations) => {
          for (const layer of layers) {
            await layer.annotate(annotations, next);
          }
        });
      },
      middleware: async (context, next) => {
        return this.layer.middleware(context, async (context) => {
          for (const layer of layers) {
            const result = await layer.middleware(context, next);
            if (result) {
              return result;
            }
          }
        });
      },
      tag: [
        this.layer.tag,
        `(` +
          layers
            .map((p) => p.tag && `(${p.tag})`)
            .filter(Boolean)
            .join(" | ") +
          ")",
      ]
        .filter(Boolean)
        .join(" -> "),
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
  _from?: Layer<{
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
// export declare function createRoutingPaths<P extends Layer<any>>(): (
//   path: LayerConfig<P>["annotation"]["out"] extends infer R
//     ? R extends { path: string; method: string }
//       ? {
//           [Obj in R as Obj["path"]]: "GET" extends Obj["method"]
//             ? Obj["path"]
//             : never;
//         }[R["path"]]
//       : never
//     : never
// ) => string;
