// Test stub for next/headers. Tests can set the guest cart cookie via setTestCookie().
const jar = new Map<string, string>();
export const setTestCookie = (k: string, v: string) => void jar.set(k, v);
export const clearTestCookies = () => jar.clear();
export async function cookies() {
  return { get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined), set: (k: string, v: string) => void jar.set(k, v), delete: (k: string) => void jar.delete(k) };
}
export async function headers() {
  return new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "node-test" });
}
