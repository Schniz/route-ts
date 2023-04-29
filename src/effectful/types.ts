import { Option, Effect } from "./dependencies";

export type Nothing = Record<never, never>;

export type Route<Annotations, Rin, Rout, Ein, Eout, Ain, Aout> = {
  _tag: "route.ts";
  desc: string;
  handler: (
    next: Effect.Effect<Rout, Eout, Option.Option<Aout>>
  ) => Effect.Effect<Rin, Ein, Option.Option<Ain>>;
  annotations: Annotations;
};

export type RinOf<R> = R extends Route<any, infer Rin, any, any, any, any, any>
  ? Rin
  : never;
export type RoutOf<R> = R extends Route<
  any,
  any,
  infer Rout,
  any,
  any,
  any,
  any
>
  ? Rout
  : never;
export type EinOf<R> = R extends Route<any, any, any, infer Ein, any, any, any>
  ? Ein
  : never;
export type EoutOf<R> = R extends Route<
  any,
  any,
  any,
  any,
  infer Eout,
  any,
  any
>
  ? Eout
  : never;
export type AinOf<R> = R extends Route<any, any, any, any, any, infer Ain, any>
  ? Ain
  : never;
export type AoutOf<R> = R extends Route<
  any,
  any,
  any,
  any,
  any,
  any,
  infer Aout
>
  ? Aout
  : never;
