/* eslint-disable no-mutable-exports */
let pathCache = new WeakMap(); // keep as mutable.
let scopeCache = new WeakMap(); // keep as mutable.

export { pathCache, scopeCache };

export function clearPathCache() {
  pathCache = new WeakMap();
}

export function clearScopeCache() {
  scopeCache = new WeakMap();
}

export function clearCaches() {
  clearPathCache();
  clearScopeCache();
}
