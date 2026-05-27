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
      // Validate parameters
      if (locations.params) {
        for (const key of locations.params) {
          const id = req.params[key];
          if (id && typeof id === 'string') {
            FileOperations.validateId(id);
          }
        }
      }

      // Validate query strings
      if (locations.query) {
        for (const key of locations.query) {
          const value = req.query[key];
          if (value && typeof value === 'string') {
            FileOperations.validateId(value);
          }
        }
      }

      // Validate request body
      if (locations.body) {
        for (const key of locations.body) {
          const value = (req.body as Record<string, unknown>)?.[key];
          if (value && typeof value === 'string') {
            FileOperations.validateId(value);
          }
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
