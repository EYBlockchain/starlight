"use strict";
/* eslint-disable max-classes-per-file */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.FilingError = exports.ZKPError = exports.TODOError = exports.SyntaxUsageError = exports.SyntaxTypeError = exports.SyntaxError = exports.ParseError = void 0;
var backtrace_js_1 = require("./backtrace.js");
// Remove after traversals done
var ParseError = /** @class */ (function (_super) {
    __extends(ParseError, _super);
    function ParseError(message) {
        var _this = _super.call(this, message) || this;
        // Ensure the name of this error is the same as the class name
        _this.name = _this.constructor.name;
        // This clips the constructor invocation from the stack trace.
        // It's not absolutely essential, but it does make the stack trace a little nicer.
        Error.captureStackTrace(_this, _this.constructor);
        return _this;
    }
    return ParseError;
}(Error));
exports.ParseError = ParseError;
var SyntaxError = /** @class */ (function (_super) {
    __extends(SyntaxError, _super);
    function SyntaxError(message) {
        var _this = this;
        Error.stackTraceLimit = 0;
        _this = _super.call(this, message) || this;
        _this.name = _this.constructor.name;
        return _this;
    }
    return SyntaxError;
}(Error));
exports.SyntaxError = SyntaxError;
var SyntaxTypeError = /** @class */ (function (_super) {
    __extends(SyntaxTypeError, _super);
    // when our decorators are used on an incorrect type
    function SyntaxTypeError(node, decorator) {
        var _this = this;
        Error.stackTraceLimit = 0;
        _this = _super.call(this, "Decorator '".concat(decorator, "' cannot be added to node of type '").concat(node.nodeType, "'.")) || this;
        // TODO - a 'help' note for each decorator? Or just direct to readme?
        switch (decorator) {
            case 'secret':
            case 'unknown':
            case 'known':
                break;
            default:
        }
        backtrace_js_1["default"].getSourceCode(node.src);
        _this.name = _this.constructor.name;
        return _this;
    }
    return SyntaxTypeError;
}(SyntaxError));
exports.SyntaxTypeError = SyntaxTypeError;
var SyntaxUsageError = /** @class */ (function (_super) {
    __extends(SyntaxUsageError, _super);
    // when our decorators are used incorrectly e.g. an unknown whole state
    function SyntaxUsageError(message, node, reasons) {
        var _this = this;
        Error.stackTraceLimit = 0;
        _this = _super.call(this, message) || this;
        if (node)
            backtrace_js_1["default"].getSourceCode(node.src);
        if (reasons) {
            reasons.forEach(function (reason) {
                console.log("Because of: ".concat(reason[0], " At:"));
                backtrace_js_1["default"].getSourceCode(reason.src);
            });
        }
        _this.name = _this.constructor.name;
        return _this;
    }
    return SyntaxUsageError;
}(SyntaxError));
exports.SyntaxUsageError = SyntaxUsageError;
var TODOError = /** @class */ (function (_super) {
    __extends(TODOError, _super);
    function TODOError(message, node) {
        var _this = this;
        Error.stackTraceLimit = 0;
        _this = _super.call(this, "TODO: zappify doesn't yet support this feature: ".concat(message)) || this;
        if (node)
            backtrace_js_1["default"].getSourceCode(node.src);
        _this.name = _this.constructor.name;
        return _this;
    }
    return TODOError;
}(Error));
exports.TODOError = TODOError;
var ZKPError = /** @class */ (function (_super) {
    __extends(ZKPError, _super);
    function ZKPError(message, node) {
        var _this = this;
        Error.stackTraceLimit = 0;
        _this = _super.call(this, message) || this;
        if (node)
            backtrace_js_1["default"].getSourceCode(node.src);
        _this.name = _this.constructor.name;
        return _this;
    }
    return ZKPError;
}(Error));
exports.ZKPError = ZKPError;
var FilingError = /** @class */ (function (_super) {
    __extends(FilingError, _super);
    function FilingError(message) {
        var _this = this;
        Error.stackTraceLimit = 0;
        _this = _super.call(this, message) || this;
        _this.name = _this.constructor.name;
        return _this;
    }
    return FilingError;
}(Error));
exports.FilingError = FilingError;
