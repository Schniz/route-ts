import { Option, Effect } from "effect";
import { Route } from "./types";

export const joinDesc = (desc: string, desc2: string) => `${desc} -> ${desc2}`;

export function toEffect<Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
  route: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
): Effect.Effect<Rin, Ein, Option.Option<Ain>> {
  return route.handler(Effect.succeed(Option.none()));
}
