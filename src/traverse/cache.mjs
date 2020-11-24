export let path = new WeakMap();
export let scope = new WeakMap();

export function clearPathCache() {
  path = new WeakMap();
}

export function clearScopeCache() {
  scope = new WeakMap();
}

export function clearCaches() {
  clearPathCache();
  clearScopeCache();
}
