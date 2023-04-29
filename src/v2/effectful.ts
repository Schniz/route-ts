import { Layer } from "../v2";
import * as Effect from "@effect/io/Effect";
import { Passthrough } from "./type-modifiers";

export function effectful<Env, Returns, Ann>(): Layer<{
  annotation: Passthrough<Ann>;
  context: Passthrough<Env>;
  return: { out: Returns; in: Effect.Effect<never, never, Returns> };
}> {
  return {
    tag: `effectful`,
    annotate(current, next) {
      return next(current);
    },
    async middleware(context, next) {
      const effect = await next(context);
      if (effect) {
        return Effect.runPromise(effect);
      }
    },
  };
}
