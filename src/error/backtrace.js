"use strict";
exports.__esModule = true;
var getNthOccurenceOfSubstring = function (string, subString, n) {
    return string.split(subString, n).join(subString).length;
};
var BackTrace = /** @class */ (function () {
    function BackTrace() {
    }
    BackTrace.prototype.setSolContract = function (contract) {
        this.contract = contract;
    };
    BackTrace.prototype.getSolContract = function () {
        return this.contract;
    };
    BackTrace.prototype.getSourceCode = function (src) {
        var contract = this.contract;
        var _a = src.split(':'), srcStart = _a[0], srcLength = _a[1];
        var srcEnd = Number(srcStart) + Number(srcLength);
        var srcCode = contract.slice(srcStart, srcEnd);
        var stringToStart = contract.substring(0, srcStart);
        var lineStart = stringToStart.lastIndexOf('\r\n') + 2;
        var lines = stringToStart.split('\r\n');
        var startLineNumber = lines.length;
        var lineEnd = getNthOccurenceOfSubstring(contract, '\r\n', startLineNumber);
        var line = contract.substring(lineStart, lineEnd);
        var srcStartWithinLine = Number(srcStart) - lineStart;
        var pointerLine = ' '.repeat(srcStartWithinLine) + '^'.repeat(Number(srcLength));
        console.log('line', startLineNumber);
        console.log(line);
        console.log(pointerLine);
        return [src, srcCode, startLineNumber, line, pointerLine];
    };
    return BackTrace;
}());
var backtrace = new BackTrace();
exports["default"] = backtrace;
