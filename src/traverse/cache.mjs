/* eslint-disable import/no-mutable-exports */
let pathCache = new WeakMap(); // keep as mutable, to enable the 'clear' functions
let scopeCache = new WeakMap(); // keep as mutable
let bindingCache = new WeakMap(); // keep as mutable
let indicatorCache = new WeakMap(); // keep as mutable

export { pathCache, scopeCache, bindingCache, indicatorCache };

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
