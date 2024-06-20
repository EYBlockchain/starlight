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
const decorators = [/(?<![\w])known(?![\w])/g, /(?<![\w])unknown(?![\w])/g, /(?<![\w])secret(?![\w])/g, /(?<![\w])reinitialisable(?![\w])/g, /(?<![\w])encrypt(?![\w])/g, /(?<![\w])sharedSecret(?![\w])/g];

// keywords - throws an error if function name/ variable name/ contracts etc is a decorator.
// eg:  function secret (...) is not allowed , permits functions secret12(...)

let solKeywords = [/contract/,/function/,/struct/,/enum/,/bool/,/fixed/,/address/,/uint[0-9]{0,3}/,/int[0-9]{0,3}/];
let solVisib = ['public', 'private', 'memory', 'storage', 'calldata'];
let zolKeywords = [/secret[\W]/,/known[\W]/,/unknown[\W]/,/reinitialisable[\W]/, /encrypt[\W]/, /sharedSecret[\W]/];
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
 * Takes an input '.zol' file and rearranges any complete struct overwrites.
 * returns deDecoratedFile // a '.sol' file, where the struct overwrites
 *    are rewritten per property.
 */

function arrangeStructOverwrite(substrings: any) {
  let structTypes = [];
  let structProps = [];
  let structStates = [];
  // clones array
  let newSubStrings = substrings.slice();
  let offset = 0;
  const getTypeNameRegExp = /(?<=struct )(.*)(?={)/;
  // matches type exactly, allowing for whitespace
  const getLHSRegExp = (type: string) => { return new RegExp('\\s?' + type + '(?![\\w])\\s?'); };
  // matches struct names by finding name in (e.g.) MyStruct memory <name> <ending char e.g.;>
  const getStateNameRegExp = (type: string, storage: string) => {
    return new RegExp('(?<=' + type + ' ' + storage + ').+?' + '(?=\,|\\)|\;|=)');
  };
  // matches if is a secret mapping where value is a struct
  // to get the mapping name, choose group 1, not match
  const getMappingStateNameRegExp = (type: string, storage: string) => {
    return new RegExp(`\\bsecret mapping\\b.*=>\\s?` + type + `\\)\\s?` + storage + `\\s?(.*?);`)
  }

  const notDeclaration = (line: string) => {
    let result = true;
    solVisib.forEach(keyword => {
      if (line.includes(`${keyword} `)) result = false;
    });
    return result;
  }

  // fill array of struct types
  for (let i=0; i<substrings.length; i++) {
    if (substrings[i].startsWith('struct ')) {
      structTypes.push(substrings[i].match(getTypeNameRegExp)[0].replace(' ', ''));
      structProps[structTypes.length - 1] = [];
      let j = i;
      let props = [];
      while (!substrings[j].includes('}')) {
        props.push(substrings[j])
        j++;
      }
      props = props.join('').match(/{(.*)/)[0].replace('{', '').replace('}', '').split(';');
      props.forEach(p => {
        p = p.split(' ')[1];
        if (p) structProps[structTypes.length - 1].push(p);
      });
    }
  }

  // fill array of struct state names
  for (let j = 0; j<substrings.length; j++) {
    for (let k = 0; k<structTypes.length; k++) {
      solVisib.forEach(r => {
        if (getStateNameRegExp(structTypes[k], r).test(substrings[j])) {
          structStates.push({ name: tidy(substrings[j].match(getStateNameRegExp(structTypes[k], r))[0]).replace(' ', ''), type: structTypes[k], line: j} )
        } else if (getMappingStateNameRegExp(structTypes[k], r).test(substrings[j])) {
          structStates.push({ name: substrings[j].match(getMappingStateNameRegExp(structTypes[k], r))[1], type: structTypes[k], line: j} )
        }
      })

    }
  }
  // find overwrites of structs
  for (let i = 0; i<substrings.length; i++) {
    for (let k = 0; k<structStates.length; k++) {
      if (substrings[i].includes(`=`) &&
        // remove anything inside brackets
        !substrings[i].replace(/\s*\[.*?\]\s*/g, '').includes('.') &&
        notDeclaration(substrings[i])
      ) {
        const [lhs, rhs] = substrings[i].split('=');
        if (getLHSRegExp(structStates[k].name).test(lhs.replace(/\s*\[.*?\]\s*/g, ''))) {
          // const lhs = structStates[k].name;
          // const rhs = substrings[i].replace(structStates[k].name, '').replace('=', '').replace(';', '').replace(' ', '');
          let newLines = [];
          structProps[structTypes.indexOf(structStates[k].type)].forEach(prop => {
            newLines.push(`${tidy(lhs)}.${prop} = ${tidy(rhs).replace(';', '')}.${prop};`);
          });
          newSubStrings.splice(i + offset, 1, ...newLines);
          offset += newLines.length - 1;
        }
      }
    }
  }
  return newSubStrings;
}

/**
 * Takes an input '.zol' file and rearranges the modifiers.
 * returns deDecoratedFile // a '.sol' file, where the modifiiers
 *     body is copied over to function body .
 */

function arrangeModifiers(substrings: any) {
  let splCharsRegExp = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
  let parameterRegExp = /\(|\)|\[|\]/g;


  let modifierRemovedSubString = substrings;
  let modifierContent = '';
  let ParameterList = [];
  let modifierParameterList= [];

  for (var i=0; i<substrings.length; i++) {

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
        if (hasParameters) {
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

          if (substrings[j].startsWith(modifierslist) && (modifierslist != 'modifier '))  {

            ParameterList = substrings[j].slice(
              substrings[j].indexOf('(') + 1,
              substrings[j].lastIndexOf(')'),
            ).trim().split(",");
            for (var n =0; n < ParameterList.length ;  n++) {
              ParameterList[n] = ParameterList[n].substring(ParameterList[n].replace(/^\s/, '').indexOf(' ') + 1);
              ParameterList[n] = ParameterList[n].replace(/\s/g,'')
            }
            for (var k=j+1; k<i; k++) {
              if (hasParameters) {
                for (var n =0; n < ParameterList.length ;  n++) {
                  const indexes = [...substrings[k].matchAll(new RegExp(ParameterList[n], 'gi'))].map(a => a.index);
                  if (indexes.length>0) {
                    for (var p =0;p<indexes.length;p++) {
                      if (splCharsRegExp.test(substrings[k].charAt(indexes[p]-1)) && splCharsRegExp.test(substrings[k].charAt(indexes[p]+(ParameterList[n].length)))) {
                        substrings[k] = substrings[k].replace(ParameterList[n],modifierParameterList[n]);
                      }
                    }
                  }
                }
              }
            if (substrings[k] === "_;")
            break;
            modifierContent += substrings[k] + '\n';
            }
          }
        }
       modifierRemovedSubString.splice(i+1, 0, modifierContent);
      }
    }
  }
  return modifierRemovedSubString;
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
  logger.verbose(`Parsing decorated file ${options.inputFilePath}... `);
  const decLines = fs
    .readFileSync(options.inputFilePath, 'utf-8')
    .split(/\r?\n/);

  let decoratedFile: any;

  // tidy each line before any changes - so no char numbers are skewed
  let tidyDecLines = decLines.map(decLine => tidy(decLine));

  if (tidyDecLines.join(' ').includes('modifier'))
    tidyDecLines = arrangeModifiers(tidyDecLines);

  if (tidyDecLines.join(' ').includes('struct'))
    tidyDecLines = arrangeStructOverwrite(tidyDecLines)

  // combine lines in new file
  decoratedFile = tidyDecLines.join('\r\n');

  // now we remove decorators and remember how many characters are offset

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
