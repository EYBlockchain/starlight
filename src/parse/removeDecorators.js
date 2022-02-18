"use strict";
/**
Reads an input file line by line and passes each line for further processing
*/
exports.__esModule = true;
/* eslint-disable no-continue */
var fs_1 = require("fs");
var path_1 = require("path");
var backtrace_mjs_1 = require("../error/backtrace.mjs");
var logger_mjs_1 = require("../utils/logger.mjs");
// regex: matches all cases of 'known' unless they are directly preceded by 'un'
var decorators = ['secret', 'unknown', /\w*(?<!un)known/g, 'reinitialisable'];
function tidy(_line) {
    var line = _line;
    // trim multiple spaces to a single space:
    line = line.replace(/\s+/g, ' ');
    // remove spaces from the start of the line:
    line = line.replace(/^\s/, '');
    return line;
}
function inComment(file, char) {
    var _a, _b;
    // are we in a comment?
    var aComment = false;
    var aMultiComment = false;
    for (var ii = 1; ii < char + 1; ii++) {
        // we take the latest two character substring
        var twoCharSubStr = file.substring(ii - 1, ii + 1);
        // if we're in a multi line comment, we ignore everything until it closes
        if (aMultiComment) {
            if (twoCharSubStr === "*/")
                _a = [false, false], aComment = _a[0], aMultiComment = _a[1];
        }
        else {
            // otherwise, we're looking for a start of a comment or a new line
            if (twoCharSubStr === "//")
                aComment = true;
            if (twoCharSubStr === "/*")
                _b = [true, true], aComment = _b[0], aMultiComment = _b[1];
            if (twoCharSubStr.includes("\r") || twoCharSubStr.includes("\n"))
                aComment = false;
        }
    }
    return aComment;
}
/**
 * Takes an input '.zol' file and removes the privacy keywords.
 * @return {Object} = {
 *     deDecoratedFile // a '.sol' file, stripped of any keywords, so
 *                        that 'solc' may compile it.
 *     toRedecorate // an array of objects recording where the
 *                     decorator keywords should be reinstated after
 *                     running 'solc'.
 */
function removeDecorators(options) {
    logger_mjs_1["default"].verbose("Parsing decorated file ".concat(options.inputFilePath, "... "));
    var decLines = fs_1["default"]
        .readFileSync(options.inputFilePath, 'utf-8')
        .split(/\r?\n/);
    // tidy each line before any changes - so no char numbers are skewed
    var tidyDecLines = decLines.map(function (decLine) { return tidy(decLine); });
    // combine lines in new file
    var decoratedFile = tidyDecLines.join('\r\n');
    // now we remove decorators and remember how many characters are offset
    // init file
    var deDecoratedFile = decoratedFile;
    // init redecorate obj
    var toRedecorate = [];
    // init matches obj
    var matches = [];
    for (var _i = 0, decorators_1 = decorators; _i < decorators_1.length; _i++) {
        var decorator = decorators_1[_i];
        // collate decorator matches in one array
        matches.push.apply(matches, deDecoratedFile.matchAll(decorator));
    }
    // number of chars to offset
    var offset = 0;
    // sort the array of decorators by their location (char index) in the contract
    matches.sort(function (matchA, matchB) { return matchA.index - matchB.index; });
    for (var _a = 0, matches_1 = matches; _a < matches_1.length; _a++) {
        var match = matches_1[_a];
        // skip removal and offsetting if we're in a comment
        if (inComment(decoratedFile, match.index))
            continue;
        // add this keyword length to offset, since we'll remove it (add one for the space we remove)
        var offsetSrcStart = match.index - offset;
        // save the keyword and where the next word starts
        toRedecorate.push({ decorator: match[0], charStart: offsetSrcStart });
        // replace the dedecorated file with one w/o the keyword (and remove one space)
        deDecoratedFile =
            deDecoratedFile.substring(0, offsetSrcStart) +
                deDecoratedFile.substring(offsetSrcStart + match[0].length + 1);
        offset += match[0].length + 1;
    }
    // const deDecoratedFile = deDecledLines.join('\r\n');
    backtrace_mjs_1["default"].setSolContract(deDecoratedFile); // store for later backtracing 'src' locators to lines of original code.
    var deDecoratedFilePath = "".concat(options.parseDirPath, "/").concat(options.inputFileName, "_dedecorated.sol");
    fs_1["default"].writeFileSync(deDecoratedFilePath, deDecoratedFile); // TODO: consider adding a 'safe' cli option to prevent overwrites.
    // Let's also copy the original input file to this output dir:
    var duplicateInputFilePath = "".concat(options.parseDirPath, "/").concat(path_1["default"].basename(options.inputFilePath));
    fs_1["default"].copyFileSync(options.inputFilePath, duplicateInputFilePath);
    return { deDecoratedFile: deDecoratedFile, toRedecorate: toRedecorate };
}
exports["default"] = removeDecorators;
