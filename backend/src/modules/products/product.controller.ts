import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class ProductController {
  public static async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await ProductService.createCategory(req.body, req.user!.userId);
      sendCreated(res, category, 'Product category created successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await ProductService.listCategories();
      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  }

  public static async createProduct(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.createProduct(req.body, req.user!.userId);
      sendCreated(res, product, 'Product created successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string | undefined;

      const result = await ProductService.listProducts(page, limit, status);
      sendSuccess(res, result.products, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  public static async getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await ProductService.getProductById(id!);
      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await ProductService.updateProduct(id!, req.body);
      sendSuccess(res, product, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
