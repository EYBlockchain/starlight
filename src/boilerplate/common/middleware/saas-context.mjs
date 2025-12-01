/**
 * @file saas-context.mjs
 * @description Express middleware for parsing and validating x-saas-context header.
 * This middleware enables multi-tenant mode by extracting the accountId from the request header.
 */

import logger from '../logger.mjs';
import config from 'config';

/**
 * Middleware to parse and validate the x-saas-context header.
 *
 * Header format:
 *   x-saas-context: {"accountId": "user-123"}
 *
 * Behavior depends on config.multiTenant setting:
 * - If config.multiTenant is true (strict mode):
 *   * Header is REQUIRED - returns 400 if missing
 *   * All requests must include valid x-saas-context header
 * - If config.multiTenant is false (permissive mode):
 *   * Header is optional - proceeds in single-tenant mode if missing
 *   * Backward compatible with single-tenant deployments
 *
 * If the header is present and valid, attaches req.saasContext with the parsed data.
 * If the header is present but invalid, returns a 400 error.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function saasContextMiddleware(req, res, next) {
  try {
    const headerValue = req.headers['x-saas-context'];
    const isStrictMode = config.multiTenant === true;

    // If header is not present
    if (!headerValue) {
      // In strict multi-tenant mode, header is required
      if (isStrictMode) {
        logger.warn('x-saas-context header required in multi-tenant mode but not provided');
        return res.status(400).json({
          error: 'SaaS context required',
          message: 'This application is running in multi-tenant mode and requires the x-saas-context header',
          example: '{"accountId": "user-123"}',
          hint: 'Add the x-saas-context header to your request'
        });
      }

      // In permissive mode, proceed in single-tenant mode
      logger.debug('No x-saas-context header - using single-tenant mode');
      req.saasContext = undefined;
      return next();
    }

    // Parse the header value
    let context;
    try {
      context = JSON.parse(headerValue);
    } catch (parseError) {
      logger.warn('Invalid JSON in x-saas-context header:', parseError);
      return res.status(400).json({
        error: 'Invalid x-saas-context header',
        message: 'Header value must be valid JSON',
        example: '{"accountId": "user-123"}'
      });
    }

    // Validate accountId is present
    if (!context.accountId) {
      logger.warn('x-saas-context header missing accountId');
      return res.status(400).json({
        error: 'Invalid x-saas-context header',
        message: 'accountId is required',
        example: '{"accountId": "user-123"}'
      });
    }

    // Validate accountId is a string
    if (typeof context.accountId !== 'string') {
      logger.warn('x-saas-context accountId is not a string:', typeof context.accountId);
      return res.status(400).json({
        error: 'Invalid x-saas-context header',
        message: 'accountId must be a string',
        received: typeof context.accountId
      });
    }

    // Validate accountId format (alphanumeric, hyphens, underscores only)
    // This prevents injection attacks and ensures compatibility with database queries
    if (!/^[a-zA-Z0-9_-]+$/.test(context.accountId)) {
      logger.warn('x-saas-context accountId has invalid format:', context.accountId);
      return res.status(400).json({
        error: 'Invalid x-saas-context header',
        message: 'accountId must contain only alphanumeric characters, hyphens, and underscores',
        pattern: '^[a-zA-Z0-9_-]+$',
        received: context.accountId
      });
    }

    // Validate accountId length (prevent excessively long IDs)
    if (context.accountId.length > 128) {
      logger.warn('x-saas-context accountId too long:', context.accountId.length);
      return res.status(400).json({
        error: 'Invalid x-saas-context header',
        message: 'accountId must be 128 characters or less',
        received: context.accountId.length
      });
    }

    // Attach validated context to request
    req.saasContext = {
      accountId: context.accountId
    };

    logger.debug(`SaaS context set for accountId: ${context.accountId}`);
    next();
  } catch (error) {
    // Catch any unexpected errors
    logger.error('Unexpected error in saasContextMiddleware:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process x-saas-context header'
    });
  }
}

/**
 * Middleware to require SaaS context (multi-tenant mode).
 * Use this middleware on routes that MUST have a SaaS context.
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function requireSaasContext(req, res, next) {
  if (!req.saasContext || !req.saasContext.accountId) {
    logger.warn('SaaS context required but not provided');
    return res.status(400).json({
      error: 'SaaS context required',
      message: 'This endpoint requires the x-saas-context header',
      example: '{"accountId": "user-123"}'
    });
  }
  next();
}

/**
 * Middleware to forbid SaaS context (single-tenant mode only).
 * Use this middleware on routes that should NOT accept a SaaS context.
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function forbidSaasContext(req, res, next) {
  if (req.saasContext && req.saasContext.accountId) {
    logger.warn('SaaS context provided but not allowed on this endpoint');
    return res.status(400).json({
      error: 'SaaS context not allowed',
      message: 'This endpoint does not support multi-tenant mode'
    });
  }
  next();
}

/**
 * Get the SaaS context from a request object.
 * Returns undefined if no context is present (single-tenant mode).
 * 
 * @param {import('express').Request} req - Express request object
 * @returns {import('../key-management/IKeyStorage.mjs').SaaSContext|undefined}
 */
export function getSaasContext(req) {
  return req.saasContext;
}

/**
 * Check if a request is in multi-tenant mode.
 * 
 * @param {import('express').Request} req - Express request object
 * @returns {boolean}
 */
export function isMultiTenant(req) {
  return !!(req.saasContext && req.saasContext.accountId);
}

export default {
  saasContextMiddleware,
  requireSaasContext,
  forbidSaasContext,
  getSaasContext,
  isMultiTenant
};

