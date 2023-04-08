export type Attaches<For, Obj> = {
  in: For;
  out: For & Obj;
};

export type Passthrough<T> = { in: T; out: T };
