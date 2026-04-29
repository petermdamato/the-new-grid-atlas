/**
 * Types for `import from "apache-arrow"` when TS resolves the module to Arrow.node.js
 * (see tsconfig paths + next.config webpack alias). Runtime uses real apache-arrow classes.
 */
declare module "apache-arrow" {
  export class Utf8 {
    constructor();
  }
  export class Bool {
    constructor();
  }
  export class Float64 {
    constructor();
  }
}
