import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { SupplierService } from './supplier.service.js';

export class SupplierController {
  public static async getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await SupplierService.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  public static async listSuppliers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await SupplierService.listSuppliers(page, limit, search, categoryId, status);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public static async getSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await SupplierService.getSupplier(req.params.id as string);
      res.json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }

  public static async createSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await SupplierService.createSupplier(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }

  public static async updateSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await SupplierService.updateSupplier(req.params.id as string, req.body, req.user!.userId);
      res.json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }

  public static async addSupplierProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplierProduct = await SupplierService.addSupplierProduct(req.params.id as string, req.body, req.user!.userId);
      res.status(201).json({ success: true, data: supplierProduct });
    } catch (err) {
      next(err);
    }
  }

  public static async bulkMapProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const mappings = await SupplierService.bulkMapProducts(req.params.id as string, req.body, req.user!.userId);
      res.status(201).json({ success: true, data: mappings });
    } catch (err) {
      next(err);
    }
  }

  public static async updateSupplierProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await SupplierService.updateSupplierProduct(
        req.params.id as string,
        req.params.productId as string,
        req.body,
        req.user!.userId
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async removeSupplierProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SupplierService.removeSupplierProduct(req.params.id as string, req.params.productId as string, req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async getProductSuppliersComparison(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SupplierService.getProductSuppliersComparison(req.params.productId as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async previewImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const preview = await SupplierService.previewImport(req.params.id as string, req.body);
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  }

  public static async commitImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SupplierService.commitImport(req.params.id as string, req.body, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async exportData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as string) || 'suppliers';
      const supplierId = req.query.supplierId as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const search = req.query.search as string | undefined;
      const format = (req.query.format as string) || 'json';

      const data = await SupplierService.exportData(type, { supplierId, categoryId, search });

      if (format === 'csv') {
        if (data.length === 0) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
          return res.send('');
        }
        const headers = Object.keys(data[0]);
        const csvRows = [
          headers.join(','),
          ...data.map((row: any) =>
            headers
              .map((h) => {
                const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
                // Guard against spreadsheet formula injection in CSV exports
                const sanitized = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
                return `"${sanitized.replace(/"/g, '""')}"`;
              })
              .join(',')
          ),
        ];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
        return res.send(csvRows.join('\r\n'));
      }

      if (format === 'xlsx' || format === 'excel') {
        if (data.length === 0) {
          res.setHeader('Content-Type', 'application/vnd.ms-excel');
          res.setHeader('Content-Disposition', `attachment; filename="${type}_export.xls"`);
          return res.send('');
        }
        const headers = Object.keys(data[0]);
        const xmlRows = data.map((row: any) =>
          `<tr>${headers.map((h) => `<td>${(row[h] === null || row[h] === undefined ? '' : String(row[h])).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`
        ).join('');

        const xmlWorkbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /></head>
<body>
<table border="1">
<thead><tr>${headers.map((h) => `<th style="background-color:#f1f5f9;font-weight:bold;">${h}</th>`).join('')}</tr></thead>
<tbody>${xmlRows}</tbody>
</table>
</body>
</html>`;

        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_export.xls"`);
        return res.send(xmlWorkbook);
      }

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async createRFQ(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rfq = await SupplierService.createRFQ(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: rfq });
    } catch (err) {
      next(err);
    }
  }

  public static async listRFQs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rfqs = await SupplierService.listRFQs();
      res.json({ success: true, data: rfqs });
    } catch (err) {
      next(err);
    }
  }

  public static async createQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const quotation = await SupplierService.createQuotation(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }

  public static async negotiateQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SupplierService.negotiateQuotation(req.params.id as string, req.body, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async convertQuotationToPO(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const po = await SupplierService.convertQuotationToPO(req.params.id as string, req.user!.userId);
      res.status(201).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  public static async getSupplierPerformance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const performance = await SupplierService.getSupplierPerformance(req.params.id as string);
      res.json({ success: true, data: performance });
    } catch (err) {
      next(err);
    }
  }
}
