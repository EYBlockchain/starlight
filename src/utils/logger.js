"use strict";
/*
  Pulled from https://github.com/winstonjs/winston/issues/1427 with some edits.
*/
exports.__esModule = true;
var winston_1 = require("winston");
var util_1 = require("util");
var config_1 = require("config");
var createLogger = winston_1["default"].createLogger, format = winston_1["default"].format, transports = winston_1["default"].transports;
var inspect = util_1["default"].inspect;
function formatWithInspect(val) {
    return "".concat(val instanceof Object ? '\n' : '', " ").concat(inspect(val, {
        depth: null,
        colors: true
    }));
}
exports["default"] = createLogger({
    level: config_1["default"].get('log_level') || 'info',
    format: winston_1["default"].format.combine(format.errors({ stack: true }), format.colorize(), format.printf(function (info) {
        var index = Symbol["for"]('splat'); // fix for ts compiler: https://github.com/Microsoft/TypeScript/issues/24587#issuecomment-460650063
        var splatArgs = info[index];
        var log = "".concat(info.level, ": ").concat(info.message);
        // append splat messages to log
        if (splatArgs) {
            var rest = splatArgs.map(formatWithInspect).join();
            log += " ".concat(rest);
        }
        // check if error log, if so append error stack
        if (info.stack) {
            log += " ".concat(info.stack);
        }
        return log;
    })),
    transports: [new transports.Console()]
});
