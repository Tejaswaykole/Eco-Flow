import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createWarehouseSchema, updateWarehouseSchema, transactStockSchema, setThresholdSchema } from './inventory.schema.js';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

// Warehouses
inventoryRouter.get('/warehouses', requirePermission('inventory:read'), InventoryController.listWarehouses);
inventoryRouter.post('/warehouses', requirePermission('inventory:write'), validate(createWarehouseSchema), InventoryController.createWarehouse);

// Inventory Items
inventoryRouter.get('/items', requirePermission('inventory:read'), InventoryController.listItems);
inventoryRouter.get('/items/:id', requirePermission('inventory:read'), InventoryController.getItem);
inventoryRouter.patch('/items/:id/thresholds', requirePermission('inventory:write'), validate(setThresholdSchema), InventoryController.setThresholds);

// Stock Transactions
inventoryRouter.post('/transact', requirePermission('inventory:transact'), validate(transactStockSchema), InventoryController.transactStock);
inventoryRouter.get('/transactions', requirePermission('inventory:read'), InventoryController.listTransactions);

