/**
 * tsconfig 同时引入了 DOM 类型, 这里的 CacheStorage 定义与 Workers 不同,
 * 通过断言拿到 Workers 的 caches.default。
 */
export function getEdgeCache(): Cache | null {
  try {
    const storage = caches as unknown as { default?: Cache };
    return storage.default ?? null;
  } catch {
    return null;
  }
}
