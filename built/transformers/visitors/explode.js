/* eslint-disable no-param-reassign, no-continue, no-shadow, consistent-return */
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
/**
 * @desc there's some 'lazy' syntax for writing Visitors succinctly. This
 * function 'explodes' that lazy syntax into a format which can be travsersed
 * by the traverser.
 * Lazy syntax: if multiple nodeTypes share the same `enter` & `exit`
 * functions, then you can write `'NodeType1|NodeType2': { enter(), exit() }`
 */
function explode(visitor) {
    if (visitor._exploded)
        return visitor;
    visitor._exploded = true;
    // explode piped nodeTypes
    for (const nodeType of Object.keys(visitor)) {
        const nodeTypes = nodeType.split('|');
        if (nodeTypes.length === 1)
            continue;
        const methods = visitor[nodeType];
        delete visitor[nodeType];
        for (const nodeType of nodeTypes) {
            visitor[nodeType] = methods;
        }
    }
    return visitor;
}
export default explode;
