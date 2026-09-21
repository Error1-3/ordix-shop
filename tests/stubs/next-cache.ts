// Test stub for next/cache: no caching, revalidation is a no-op.
export const unstable_cache = <T extends (...a: never[]) => unknown>(fn: T) => fn;
export const revalidateTag = () => {};
export const revalidatePath = () => {};
