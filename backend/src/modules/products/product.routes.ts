import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { validate } from '../../middleware/validate.js';
import { createCategorySchema, createProductSchema, updateProductSchema } from './product.schema.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();

// Categories
router.get('/categories', authenticate, ProductController.listCategories);
router.post('/categories', authenticate, requirePermission('product:write'), validate(createCategorySchema), ProductController.createCategory);

// Products
router.get('/', authenticate, ProductController.listProducts);
router.post('/', authenticate, requirePermission('product:write'), validate(createProductSchema), ProductController.createProduct);
router.get('/:id', authenticate, ProductController.getProduct);
router.patch('/:id', authenticate, requirePermission('product:write'), validate(updateProductSchema), ProductController.updateProduct);

export const productRouter = router;
