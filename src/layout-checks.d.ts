/**
 * Types for `@widenode/ui-foundation/layout-checks`.
 *
 * Hand-written rather than generated: the module is `.mjs` with JSDoc and this
 * package has no build step. Without this file a TypeScript consumer running
 * `vue-tsc` under `noImplicitAny` fails with TS7016 on the import, which cost
 * an adopting app a local shim.
 */

export interface LayoutCheck {
  /** Human-readable name; use it as the test title. */
  name: string
  /** The RULES.md statement this check enforces. */
  rule: string
  /**
   * Returns a list of offenders; empty means pass.
   *
   * Generic rather than Playwright's `Page` on purpose — this package does not
   * depend on `@playwright/test`, and the only thing required of `page` is an
   * `evaluate` method that takes a string. Typing it structurally would reject
   * Playwright's overloaded `evaluate`.
   */
  run<TPage>(page: TPage): Promise<string[]>
}

/** Portable checks. Safe for any consuming app, on any font. */
export declare const layoutChecks: LayoutCheck[]

/**
 * Rendered-outcome checks. Portable for an app with rounded leading and
 * declared control heights; not gateable in this package. See the module's own
 * doc comment.
 */
export declare const pixelGridChecks: LayoutCheck[]

/** @deprecated Renamed to {@link pixelGridChecks}. */
export declare const pinnedFontChecks: LayoutCheck[]

export interface SettleOptions {
  /**
   * Element that must have landed — `opacity: 1` and an identity transform.
   * Worth passing: without it the wait can pass vacuously, because an empty
   * animation list means "not started yet" as often as "finished".
   */
  selector?: string | null
  /** Milliseconds before rejecting. Default 5000. */
  timeout?: number
}

/**
 * Wait for the page to stop moving. Call before the checks whenever an action
 * opened something. Rejects if it is still moving at the timeout.
 */
export declare function settle<TPage>(page: TPage, options?: SettleOptions): Promise<void>
