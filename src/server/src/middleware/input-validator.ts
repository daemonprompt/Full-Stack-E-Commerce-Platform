import { body, param, query, ValidationChain } from 'express-validator';

/**
 * Order ID path parameter — must be a valid UUID.
 */
export const validateOrderId: ValidationChain[] = [
  param('id')
    .isUUID(4)
    .withMessage('Order ID must be a valid UUID'),
];

/**
 * Order creation body validation.
 */
export const validateCreateOrder: ValidationChain[] = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.productId')
    .isUUID(4)
    .withMessage('Product ID must be a valid UUID'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address is required'),
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City is required'),
  body('shippingAddress.postalCode')
    .trim()
    .matches(/^[A-Z0-9\s-]{3,10}$/i)
    .withMessage('Invalid postal code format'),
];

/**
 * Product search query validation.
 */
export const validateProductSearch: ValidationChain[] = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape()
    .withMessage('Search query too long'),
  query('category')
    .optional()
    .isAlphanumeric()
    .withMessage('Invalid category format'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
