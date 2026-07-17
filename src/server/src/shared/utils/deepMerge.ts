/**
 * Recursively merges source into target, supporting nested objects.
 * Useful for partial preference updates without overwriting the full object.
 */
export function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>
): Record<string, any> {
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
