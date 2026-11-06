import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { CreateCategoryInput, UpdateCategoryInput, CreateProductInput, UpdateProductInput } from './product.schema.js';
import { randomUUID } from 'crypto';

export class ProductService {
  public static async createCategory(input: CreateCategoryInput, userId: string) {
    const existing = await prisma.productCategory.findFirst({
      where: { code: input.code.toUpperCase() },
    });
    if (existing) throw new ConflictError(`Product category code '${input.code}' already exists`);

    return await prisma.productCategory.create({
      data: {
        id: randomUUID(),
        name: input.name,
        code: input.code.toUpperCase(),
        description: input.description,
        created_by: userId,
      },
    });
  }

  public static async listCategories() {
    return await prisma.productCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  public static async createProduct(input: CreateProductInput, userId: string) {
    const existing = await prisma.product.findUnique({
      where: { part_number: input.partNumber },
    });
    if (existing) throw new ConflictError(`Product part number '${input.partNumber}' already exists`);

    const category = await prisma.productCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) throw new NotFoundError('Product Category', input.categoryId);

    return await prisma.product.create({
      data: {
        id: randomUUID(),
        part_number: input.partNumber,
        name: input.name,
        description: input.description,
        category_id: input.categoryId,
        created_by: userId,
        status: 'DRAFT',
      },
      include: {
        category: true,
      },
    });
  }

  public static async listProducts(page = 1, limit = 20, status?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { part_number: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          category: { select: { id: true, name: true, code: true } },
          boms: { select: { id: true, bom_number: true, status: true, current_version: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        boms: {
          include: {
            components: true,
          },
        },
        product_versions: {
          orderBy: { version_number: 'desc' },
        },
      },
    });

    if (!product) throw new NotFoundError('Product', id);
    return product;
  }

  public static async updateProduct(id: string, input: UpdateProductInput) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product', id);

    return await prisma.product.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status && { status: input.status }),
      },
      include: { category: true },
    });
  }
}
