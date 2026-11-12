import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';

export class ReportsController {
  public static async getEngineeringReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.getEngineeringReport();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.getInventoryReport();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getPurchasingReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.getPurchasingReport();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getManufacturingReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.getManufacturingReport();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getQualityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.getQualityReport();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async exportCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as string) || 'engineering';
      const csv = await ReportsService.generateCSV(type);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ecoflow_${type}_report_${Date.now()}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

