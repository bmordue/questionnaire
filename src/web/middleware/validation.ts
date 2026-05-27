/**
 * Validation Middleware
 *
 * Provides middleware for validating identifiers in request parameters, query strings, and body fields.
 */

import type { Request, Response, NextFunction } from 'express';
import { FileOperations } from '../../core/storage/file-operations.js';

/**
 * Middleware that validates one or more identifiers in the request.
 *
 * @param locations - Map of request locations (params, query, body) to identifier keys
 * @returns Express middleware function
 */
export function validateId(locations: {
  params?: string[];
  query?: string[];
  body?: string[];
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validateValue = (value: unknown): void => {
        if (typeof value === 'string') {
          FileOperations.validateId(value);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            validateValue(item);
          }
        } else if (value !== undefined && value !== null) {
          throw new Error('Invalid ID format: must be a string');
        }
      };

      if (locations.params) {
        for (const key of locations.params) {
          validateValue(req.params[key]);
        }
      }

      if (locations.query) {
        for (const key of locations.query) {
          validateValue(req.query[key]);
        }
      }

      if (locations.body) {
        for (const key of locations.body) {
          validateValue((req.body as Record<string, unknown>)?.[key]);
        }
      }

      next();
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid identifier format'
      });
    }
  };
}
