// `after` is only valid inside a request; the app falls back to running the task directly when it throws.
export function after(): never { throw new Error("after() called outside a request scope (test stub)"); }
