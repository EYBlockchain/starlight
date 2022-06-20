/**
Reads an input file line by line and passes each line for further processing
*/

/* eslint-disable no-continue */

import fs from 'fs';
import path from 'path';
import { ToRedecorate } from './redecorate.js'
import backtrace from '../error/backtrace.js';
import logger from '../utils/logger.js';
import { boolean } from 'yargs';

// regex: matches decorators when standalone words
// eg: for {unknown knownknown known1 123lknown known secretvalue} finds only 1 match for decorator 'known'
 //const decorators = [/(?<![\w])known(?![\w\@#\$%\^\&*\)\(+=._-])/g, /(?<![\w])unknown(?![\w\@#\$%\^\&*\)\(+=._-])/g, /(?<![\w])secret(?![\w\@#\$%\^\&*\)\(+=._-])/g, /(?<![\w])reinitialisable(?![\w\@#\$%\^\&*\)\(+=._-])/g];
const decorators = [/(?<![\w])known(?![\w])/g, /(?<![\w])unknown(?![\w])/g, /(?<![\w])secret(?![\w])/g, /(?<![\w])reinitialisable(?![\w])/g];

// keywords - throws an error if function name/ variable name/ contracts etc is a decorator.
// eg:  function secret (...) is not allowed , permits functions secret12(...) 

let solKeywords = [/contract/,/function/,/struct/,/enum/,/bool/,/fixed/,/address/,/uint[0-9]{0,3}/,/int[0-9]{0,3}/];
let zolKeywords = [/secret[\W]/,/known[\W]/,/unknown[\W]/,/reinitialisable[\W]/];
let keywords = solKeywords.flatMap(sk => zolKeywords.map(zk => new RegExp(sk.source +' '+ zk.source)));

function tidy(_line: string): string {
  let line = _line;
  // trim multiple spaces to a single space:
  line = line.replace(/\s+/g, ' ');
  // remove spaces from the start of the line:
  line = line.replace(/^\s/, '');
  // remove space before special characters .,?!()
  //line = line.replace(/\s+(?=[.,?!()])/,'');
  return line;
}

function inComment(file: string, char: number): boolean {
  // our 'file' is actually a very long string here!
  // are we in a comment?
  let aComment = false;
  let aMultiComment = false;
  for (let ii = 1; ii < char + 1; ii++) {
    // we take the latest two character substring
    const twoCharSubStr = file.substring(ii - 1, ii + 1);
    // if we're in a multi line comment, we ignore everything until it closes
    if (aMultiComment) {
      if (twoCharSubStr === `*/`) [aComment, aMultiComment] = [false, false];
    } else {
      // otherwise, we're looking for a start of a comment or a new line
      if (twoCharSubStr === `//`) aComment = true;
      if (twoCharSubStr === `/*`) [aComment, aMultiComment] = [true, true];
      if (twoCharSubStr.includes(`\r`) || twoCharSubStr.includes(`\n`))
        aComment = false;
    }
  }
  return aComment;
}

/**
 * Takes an input '.zol' file and rearranges the modifiers.
 * returns deDecoratedFile // a '.sol' file, where the modifiiers
 *     body is copied over to function body .
 */

function arrangeModifiers(options: any) {
  let splCharsRegExp = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
  let parameterRegExp = /\(|\)|\[|\]/g;
  const fileString = fs.readFileSync(options.inputFilePath, 'utf-8').split(/\r?\n/);
  let substrings = fileString.map(decLine => tidy(decLine));
  let modifierRemovedSubString = substrings;
  let modifierContent = '';
  let ParameterList = [];
  let modifierParameterList= [];
  for(var i=0; i<substrings.length; i++) {
    if(substrings[i].startsWith('function'))  {
      const substringsRemoved = substrings[i].replace("public", "").replace("private","");
      let modifierslist = substringsRemoved.slice(
      substringsRemoved.indexOf(')') + 1,
      substringsRemoved.lastIndexOf('{'),
      ).trim();
      modifierslist = modifierslist.replace(/\s+(?=[.,?!()])/,'');
      modifierslist = modifierslist.replace(/\s*,\s*/g, ",");
      const modifierslistArray = modifierslist.split(" ");
      for(var m=0; m<modifierslistArray.length; m++) {
        modifierslist = 'modifier '+ modifierslistArray[m];
        let hasParameters = parameterRegExp.test(modifierslistArray[m]);
        if(hasParameters) {
          modifierParameterList = modifierslistArray[m].slice(
          modifierslistArray[m].indexOf('(') + 1,
          modifierslistArray[m].lastIndexOf(')'),
          ).trim().split(",");
         }
        modifierslist = modifierslist.replace(/ *\([^)(]*/g, "");
        if(modifierslist.endsWith(')'))
          modifierslist =modifierslist.slice(0, -1);
        modifierContent = '';
        for (var j=0; j<i; j++) {
          if(substrings[j].startsWith(modifierslist))  {
            ParameterList = substrings[j].slice(
            substrings[j].indexOf('(') + 1,
            substrings[j].lastIndexOf(')'),
            ).trim().split(",");
            for(var n =0; n < ParameterList.length ;  n++) {
            ParameterList[n] = ParameterList[n].substring(ParameterList[n].replace(/^\s/, '').indexOf(' ') + 1);
            ParameterList[n] = ParameterList[n].replace(/\s/g,'')
            }
            for(var k=j+1; k<i; k++) {
              if(hasParameters) {
                for(var n =0; n < ParameterList.length ;  n++) {
                  const indexes = [...substrings[k].matchAll(new RegExp(ParameterList[n], 'gi'))].map(a => a.index);
                  if(indexes.length>0) {
                    for (var p =0;p<indexes.length;p++) {
                      if(splCharsRegExp.test(substrings[k].charAt(indexes[p]-1)) && splCharsRegExp.test(substrings[k].charAt(indexes[p]+(ParameterList[n].length)))) {
                        substrings[k] = substrings[k].replace(ParameterList[n],modifierParameterList[n]);
                      }
                    }
                  }
                }
              }
            if (substrings[k] === "_;") 
            break;
            modifierContent += substrings[k];
            }
          }
        } 
       modifierRemovedSubString.splice(i+1, 0, modifierContent);
      } 
    }
  }
  const substringsMod = modifierRemovedSubString.join(",,").toString().replace(/,,/g, '\n');
  return substringsMod;
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
function removeDecorators(options: any): {
    deDecoratedFile: string;
    toRedecorate: ToRedecorate[];
} {
 const decoratedFile = arrangeModifiers(options);

  // init file
  let deDecoratedFile = decoratedFile;
  // init redecorate obj
  const toRedecorate = [];
  // init matches obj
  const matches = [];

  for (const decorator of decorators) {
    // collate decorator matches in one array
    matches.push(...deDecoratedFile.matchAll(decorator));
  }

  // number of chars to offset
  let offset = 0;

  // sort the array of decorators by their location (char index) in the contract
  matches.sort((matchA, matchB) => matchA.index - matchB.index);
  
  // feat: fo future use add a struct name also as keyword to identify object names that are not allowed.  
  const decoratedFileWords = deDecoratedFile.split(" ");
  for(var j=0; j< decoratedFileWords.length; j++) {
    if(decoratedFileWords[j] === 'struct')
    keywords.push(new RegExp(decoratedFileWords[j+1]));
  }

  // check if function/variables/contract/enums are named as decorators and exit by throwing appropriate error
  for(const pattern of keywords) {
    var matchKeyword = pattern.exec(decoratedFile);
    if (matchKeyword) {
        logger.error(`Cannot name Contract/function/Struct/enum/variables as decorators. Please rename ${matchKeyword.toString()} at index ${matchKeyword.index} to non decorator name`);
        process.exit(1);
    }
  }
  for (const match of matches) {
    // skip removal and offsetting if we're in a comment
    if (inComment(decoratedFile, match.index)) continue;
    // add this keyword length to offset, since we'll remove it (add one for the space we remove)
    const offsetSrcStart = match.index - offset;
    // save the keyword and where the next word starts
    toRedecorate.push({ decorator: match[0], charStart: offsetSrcStart });
    // replace the dedecorated file with one w/o the keyword (and remove one space)
    deDecoratedFile =
      deDecoratedFile.substring(0, offsetSrcStart) +
      deDecoratedFile.substring(offsetSrcStart + match[0].length + 1);
    offset += match[0].length + 1;
  }

  // const deDecoratedFile = deDecledLines.join('\r\n');
  backtrace.setSolContract(deDecoratedFile); // store for later backtracing 'src' locators to lines of original code.

  const deDecoratedFilePath = `${options.parseDirPath}/${options.inputFileName}_dedecorated.sol`;
  fs.writeFileSync(deDecoratedFilePath, deDecoratedFile); // TODO: consider adding a 'safe' cli option to prevent overwrites.

  // Let's also copy the original input file to this output dir:
  const duplicateInputFilePath = `${options.parseDirPath}/${path.basename(
    options.inputFilePath,
  )}`;
  fs.copyFileSync(options.inputFilePath, duplicateInputFilePath);
  return { deDecoratedFile, toRedecorate };
}

export default removeDecorators;
