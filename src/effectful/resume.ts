import { pipe } from "effect";
import { annotate } from "./mapping";
import { Route } from "./types";

export function mergeAnnotations<Ann, Rin, Rout, Ein, Eout, Ain, Aout>(
  referenceRoute: Route<Ann, Rin, Rout, Ein, Eout, Ain, Aout>
) {
  return <Ann2, Rin2, Rout2, Ein2, Eout2, Ain2, Aout2>(
    currentRoute: Route<Ann2, Rin2, Rout2, Ein2, Eout2, Ain2, Aout2>
  ): Route<Ann & Ann2, Rin2, Rout2, Ein2, Eout2, Ain2, Aout2> => {
    return pipe(
      currentRoute,
      annotate((current) => ({ ...referenceRoute.annotations, ...current }))
    );
  };
}
