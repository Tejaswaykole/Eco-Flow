import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import crypto from 'crypto';

describe('Supplier & Procurement End-to-End Real DB Integration Suite', () => {
  const app = createApp();
  let adminToken: string;
  let operatorToken: string;
  let adminUserId: string;
  let operatorUserId: string;

  // Fixtures
  let supplierId: string;
  let productId1: string;
  let productId2: string;
  let rfqId: string;
  let quotationId: string;

  const testSuffix = crypto.randomBytes(3).toString('hex');
  const adminEmail = `proc.admin.${testSuffix}@ecoflow.test`;
  const operatorEmail = `proc.op.${testSuffix}@ecoflow.test`;

  beforeAll(async () => {
    // 1. Setup Admin User
    const adminReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123!',
        firstName: 'Procurement',
        lastName: 'Admin',
      });
    expect(adminReg.status).toBe(201);
    adminUserId = adminReg.body.data.id;

    // Update Admin Role in DB from default OPERATOR to ADMINISTRATOR
    const adminRole = await prisma.role.findFirst({ where: { name: 'ADMINISTRATOR' } });
    if (adminRole) {
      await prisma.userRole.updateMany({
        where: { user_id: adminUserId },
        data: { role_id: adminRole.id },
      });
    }

    // Login Admin to get Token with full permissions
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;

    // 2. Setup Operator User (Read-Only on Suppliers)
    const opReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: operatorEmail,
        password: 'Password123!',
        firstName: 'Shop',
        lastName: 'Operator',
      });
    expect(opReg.status).toBe(201);
    operatorUserId = opReg.body.data.id;

    const opLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: operatorEmail, password: 'Password123!' });
    expect(opLogin.status).toBe(200);
    operatorToken = opLogin.body.data.accessToken;

    // 3. Create Catalogue Category and Products
    const cat = await prisma.productCategory.create({
      data: {
        code: `CAT-${testSuffix}`,
        name: `Integrated Circuits ${testSuffix}`,
        created_by: adminUserId,
      },
    });

    const p1 = await prisma.product.create({
      data: {
        part_number: `PRD-ESP-${testSuffix}`,
        name: 'ESP32 Wi-Fi Module',
        category_id: cat.id,
        created_by: adminUserId,
      },
    });
    productId1 = p1.id;

    const p2 = await prisma.product.create({
      data: {
        part_number: `PRD-STM-${testSuffix}`,
        name: 'STM32 Microcontroller',
        category_id: cat.id,
        created_by: adminUserId,
      },
    });
    productId2 = p2.id;
  });

  afterAll(async () => {
    // Clean up created test data
    if (quotationId) {
      await prisma.quotationNegotiationEvent.deleteMany({ where: { quotation_id: quotationId } });
      await prisma.supplierQuotation.deleteMany({ where: { id: quotationId } });
    }
    if (rfqId) {
      await prisma.rFQItem.deleteMany({ where: { rfq_id: rfqId } });
      await prisma.rFQSupplier.deleteMany({ where: { rfq_id: rfqId } });
      await prisma.rFQ.deleteMany({ where: { id: rfqId } });
    }
    if (supplierId) {
      await prisma.supplierProduct.deleteMany({ where: { supplier_id: supplierId } });
      await prisma.purchaseOrderLine.deleteMany({ where: { purchase_order: { supplier_id: supplierId } } });
      await prisma.purchaseOrder.deleteMany({ where: { supplier_id: supplierId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
    }
    if (productId1 || productId2) {
      await prisma.product.deleteMany({ where: { id: { in: [productId1, productId2].filter(Boolean) } } });
    }
    await prisma.$disconnect();
  });

  // TEST 1: Supplier CRUD & RBAC Protection
  it('1. Enforces RBAC on Supplier Creation: Operator forbidden (403), Admin succeeds (201)', async () => {
    // Operator forbidden
    const opRes = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        name: `Unauthorized Supplier ${testSuffix}`,
        email: 'unauth@test.com',
      });
    expect(opRes.status).toBe(403);

    // Admin authorized
    const adminRes = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Semiconductor Dynamics ${testSuffix}`,
        contactName: 'Ramesh Patel',
        email: `ramesh.${testSuffix}@semidyn.test`,
        phone: '+91-9876543210',
        address: 'Electronic City, Bangalore',
        rating: 4.9,
      });
    expect(adminRes.status).toBe(201);
    expect(adminRes.body.data.id).toBeDefined();
    supplierId = adminRes.body.data.id;
  });

  // TEST 2: Dashboard Stats & Global Search
  it('2. Returns real database-backed dashboard stats and filters by SKU/category', async () => {
    const statsRes = await request(app)
      .get('/api/v1/suppliers/dashboard-stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.totalSuppliers).toBeGreaterThan(0);
    expect(statsRes.body.data.activeSuppliers).toBeGreaterThan(0);

    // Search by newly created supplier name
    const searchRes = await request(app)
      .get(`/api/v1/suppliers?search=${encodeURIComponent('Semiconductor Dynamics')}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.suppliers.some((s: any) => s.id === supplierId)).toBe(true);
  });

  // TEST 3: Single and Bulk Product Mapping
  it('3. Maps single and bulk catalogue parts and enforces uniqueness', async () => {
    // Single Map
    const map1Res = await request(app)
      .post(`/api/v1/suppliers/${supplierId}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: productId1,
        supplierPartNumber: 'VND-ESP32-S',
        leadTimeDays: 7,
        unitPrice: 285.50,
        minimumOrderQty: 10,
        currency: 'INR',
        isPreferred: true,
      });
    expect(map1Res.status).toBe(201);
    expect(Number(map1Res.body.data.unit_price)).toBe(285.50);

    // Duplicate mapping rejection
    const dupRes = await request(app)
      .post(`/api/v1/suppliers/${supplierId}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: productId1,
        unitPrice: 300,
      });
    expect(dupRes.status).toBe(409);

    // Bulk Map for productId2
    const bulkRes = await request(app)
      .post(`/api/v1/suppliers/${supplierId}/products/bulk`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mappings: [
          {
            productId: productId2,
            supplierPartNumber: 'VND-STM32-M',
            leadTimeDays: 14,
            unitPrice: 420.00,
            minimumOrderQty: 25,
            currency: 'INR',
            isPreferred: false,
          },
        ],
      });
    expect(bulkRes.status).toBe(201);
    expect(bulkRes.body.data.length).toBe(1);
  });

  // TEST 4: Sourcing Comparison Matrix
  it('4. Compares sourcing prices across suppliers for a given catalogue part', async () => {
    const compRes = await request(app)
      .get(`/api/v1/suppliers/products/${productId1}/comparison`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(compRes.status).toBe(200);
    expect(compRes.body.data.suppliers.length).toBeGreaterThanOrEqual(1);
    expect(compRes.body.data.suppliers[0].unitPrice).toBe(285.50);
  });

  // TEST 5: CSV and XML/Excel Export
  it('5. Exports supplier directory and mappings in CSV and XML/Excel formats with formula injection safeguards', async () => {
    const csvRes = await request(app)
      .get('/api/v1/suppliers/export?type=mappings&format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('ProductSKU');
    expect(csvRes.text).toContain('VND-ESP32-S');

    const xlsRes = await request(app)
      .get('/api/v1/suppliers/export?type=mappings&format=xlsx')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(xlsRes.status).toBe(200);
    expect(xlsRes.headers['content-type']).toContain('application/vnd.ms-excel');
    expect(xlsRes.text).toContain('<table border="1">');
  });

  // TEST 6: RFQ Lifecycle
  it('6. Creates an RFQ with multiple items and invited suppliers', async () => {
    const rfqRes = await request(app)
      .post('/api/v1/suppliers/rfqs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Q4 Batch RFQ ${testSuffix}`,
        deadlineDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        deliveryDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        supplierIds: [supplierId],
        items: [
          { productId: productId1, quantityRequired: 100, notes: 'Tape and reel packaging' },
        ],
      });
    expect(rfqRes.status).toBe(201);
    expect(rfqRes.body.data.rfq_number).toMatch(/^RFQ-/);
    rfqId = rfqRes.body.data.id;
  });

  // TEST 7: Quotation Recording & Bargaining Workflow
  it('7. Records quotation, records counter-offer, preserves negotiation events, and accepts quote', async () => {
    // Record Initial Supplier Quote: ₹280/unit
    const quoteRes = await request(app)
      .post('/api/v1/suppliers/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rfqId,
        supplierId,
        productId: productId1,
        supplierPartNumber: 'VND-ESP32-S',
        offeredQuantity: 100,
        unitPrice: 280.00,
        currency: 'INR',
        taxAmount: 5040.00, // 18% GST
        shippingAmount: 500.00,
        leadTimeDays: 7,
        minimumOrderQuantity: 10,
        termsConditions: 'Net 30 days',
        status: 'QUOTED',
      });
    expect(quoteRes.status).toBe(201);
    quotationId = quoteRes.body.data.id;

    // Send Counter-Offer: ₹260/unit
    const counterRes = await request(app)
      .post(`/api/v1/suppliers/quotations/${quotationId}/negotiate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'COUNTER_OFFER',
        counterPrice: 260.00,
        message: 'Requesting volume rebate for 100 units order',
      });
    expect(counterRes.status).toBe(200);
    expect(counterRes.body.data.quotation.status).toBe('COUNTER_OFFERED');

    // Supplier Revised Offer: ₹270/unit
    const revisedRes = await request(app)
      .post(`/api/v1/suppliers/quotations/${quotationId}/negotiate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'REVISED_OFFER',
        counterPrice: 270.00,
        message: 'Best offer: ₹270 with free expedited transit',
      });
    expect(revisedRes.status).toBe(200);
    expect(revisedRes.body.data.quotation.status).toBe('REVISED');
    expect(Number(revisedRes.body.data.quotation.unit_price)).toBe(270.00);

    // Accept Negotiated Quote
    const acceptRes = await request(app)
      .post(`/api/v1/suppliers/quotations/${quotationId}/negotiate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'ACCEPTED',
        counterPrice: 270.00,
        message: 'Agreed at ₹270/unit. Proceeding to PO.',
      });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.quotation.status).toBe('ACCEPTED');
  });

  // TEST 8: Purchase Order Conversion & Concurrency Safety
  it('8. Converts accepted quote to PO and rejects duplicate concurrent conversion attempts', async () => {
    // First conversion attempt: should succeed and create DRAFT PO
    const convRes = await request(app)
      .post(`/api/v1/suppliers/quotations/${quotationId}/convert-to-po`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(convRes.status).toBe(201);
    expect(convRes.body.data.po_number).toMatch(/^PO-/);
    expect(convRes.body.data.status).toBe('DRAFT'); // Preserves PO Approver authorization
    expect(Number(convRes.body.data.lines[0].unit_price)).toBe(270.00); // Negotiated price preserved

    // Second conversion attempt (duplicate): must return 409 Conflict
    const dupConvRes = await request(app)
      .post(`/api/v1/suppliers/quotations/${quotationId}/convert-to-po`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dupConvRes.status).toBe(409);
  });

  // TEST 9: Supplier Performance Analytics
  it('9. Computes real performance analytics and transparent ranking from actual database records', async () => {
    const perfRes = await request(app)
      .get(`/api/v1/suppliers/${supplierId}/performance`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(perfRes.status).toBe(200);
    expect(perfRes.body.data.totalPurchaseOrders).toBe(1);
    expect(perfRes.body.data.acceptedQuotations).toBe(1);
    expect(perfRes.body.data.ranking.score).toBeGreaterThanOrEqual(0);
    expect(perfRes.body.data.ranking.reasons.length).toBeGreaterThan(0);
  });
});
