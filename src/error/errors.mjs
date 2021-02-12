/* eslint-disable max-classes-per-file */

import backtrace from './backtrace.mjs'

export class ParseError extends Error {
  constructor(message) {
    super(message);
    // Ensure the name of this error is the same as the class name
    this.name = this.constructor.name;
    // This clips the constructor invocation from the stack trace.
    // It's not absolutely essential, but it does make the stack trace a little nicer.
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnsupportedSyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TODOError extends Error {
  constructor(message) {
    super(`TODO: zappify doesn't yet support this feature. ${message}`);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class FilingError extends Error {
  constructor(message) {
    Error.stackTraceLimit = 0;
    super(message);
    this.name = this.constructor.name;
  }
}
