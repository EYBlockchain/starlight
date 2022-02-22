"use strict";
/* eslint-disable import/no-mutable-exports */
exports.__esModule = true;
exports.clearCaches = exports.clearScopeCache = exports.clearPathCache = exports.indicatorCache = exports.bindingCache = exports.scopeCache = exports.pathCache = void 0;
/**
This file contains portions of code from Babel (https://github.com/babel/babel). All such code has been modified for use in this repository. See below for Babel's MIT license and copyright notice:

MIT License

Copyright (c) 2014-present Sebastian McKenzie and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
var pathCache = new WeakMap(); // keep as mutable, to enable the 'clear' functions
exports.pathCache = pathCache;
var scopeCache = new WeakMap(); // keep as mutable
exports.scopeCache = scopeCache;
var bindingCache = new WeakMap(); // keep as mutable
exports.bindingCache = bindingCache;
var indicatorCache = new WeakMap(); // keep as mutable
exports.indicatorCache = indicatorCache;
function clearPathCache() {
    exports.pathCache = pathCache = new WeakMap();
}
exports.clearPathCache = clearPathCache;
function clearScopeCache() {
    exports.scopeCache = scopeCache = new WeakMap();
}
exports.clearScopeCache = clearScopeCache;
function clearCaches() {
    clearPathCache();
    clearScopeCache();
}
exports.clearCaches = clearCaches;
