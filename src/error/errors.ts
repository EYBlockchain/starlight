/* eslint-disable max-classes-per-file */

import backtrace from './backtrace.js'
// Remove after traversals done
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    // Ensure the name of this error is the same as the class name
    this.name = this.constructor.name;
    // This clips the constructor invocation from the stack trace.
    // It's not absolutely essential, but it does make the stack trace a little nicer.
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SyntaxError extends Error {
  constructor(message: string) {
    Error.stackTraceLimit = 0;
    super(message);
    this.name = this.constructor.name;
  }
}

export class SyntaxTypeError extends SyntaxError {
  // when our decorators are used on an incorrect type
  constructor(node: any, decorator: string) {
    Error.stackTraceLimit = 0;
    super(
      `Decorator '${decorator}' cannot be added to node of type '${node.nodeType}'.`,
    );
    // TODO - a 'help' note for each decorator? Or just direct to readme?
    switch (decorator) {
      case 'secret':
      case 'unknown':
      case 'known':
        break;
      default:
    }
    backtrace.getSourceCode(node.src);
    this.name = this.constructor.name;
  }
}

export class SyntaxUsageError extends SyntaxError {
  // when our decorators are used incorrectly e.g. an unknown whole state
  constructor(message: string, node: any, reasons?: any) {
    Error.stackTraceLimit = 0;
    super(message);
    if (node) backtrace.getSourceCode(node.src);
    if (reasons) {
      reasons.forEach((reason: any) => {
        console.log(`Because of: ${reason[0]} At:`);
        backtrace.getSourceCode(reason.src);
      });
    }
    this.name = this.constructor.name;
  }
}

export class TODOError extends Error {
  constructor(message: string, node: any) {
    Error.stackTraceLimit = 0;
    super(`TODO: zappify doesn't yet support this feature: ${message}`);
    if (node) backtrace.getSourceCode(node.src);
    this.name = this.constructor.name;
  }
}

export class ZKPError extends Error {
  constructor(message: string, node: any) {
    Error.stackTraceLimit = 0;
    super(message);
    if (node) backtrace.getSourceCode(node.src);
    this.name = this.constructor.name;
  }
}

export class FilingError extends Error {
  constructor(message: any) {
    Error.stackTraceLimit = 0;
    super(message);
    this.name = this.constructor.name;
  }
}
