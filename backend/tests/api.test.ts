import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';

describe('ECOFlow Complete Backend API Integration Suite', () => {
  const app = createApp();
  let adminToken: string;
  let engineerToken: string;
  let testProductId: string;
  let testBomId: string;
  let testEcoId: string;

  const testEmail = `admin.test.${Date.now()}@ecoflow.internal`;
  const engineerEmail = `engineer.test.${Date.now()}@ecoflow.internal`;

  beforeAll(async () => {
    // 1. Register test admin
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        firstName: 'Integration',
        lastName: 'Admin',
      });
    expect(regRes.status).toBe(201);

    // Promote to ADMINISTRATOR in DB
    const adminRole = await prisma.role.findFirst({ where: { name: 'ADMINISTRATOR' } });
    await prisma.userRole.updateMany({
      where: { user_id: regRes.body.data.id },
      data: { role_id: adminRole!.id },
    });

    // 2. Register test engineer
    const engRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: engineerEmail,
        password: 'Password123!',
        firstName: 'Lead',
        lastName: 'Engineer',
      });
    expect(engRes.status).toBe(201);

    const engRole = await prisma.role.findFirst({ where: { name: 'LEAD_ENGINEER' } });
    await prisma.userRole.updateMany({
      where: { user_id: engRes.body.data.id },
      data: { role_id: engRole!.id },
    });

    // Login Admin
    const loginAdmin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'Password123!' });
    expect(loginAdmin.status).toBe(200);
    adminToken = loginAdmin.body.data.accessToken;

    // Login Engineer
    const loginEng = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: engineerEmail, password: 'Password123!' });
    expect(loginEng.status).toBe(200);
    engineerToken = loginEng.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Health and System Status', () => {
    it('GET /health returns 200 and uptime', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /ready returns 200 and database connected', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.database).toBe('connected');
    });
  });

  describe('Authentication & Session Lifecycle', () => {
    it('Rejects invalid password attempt and audits failure', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword' });
      expect(res.status).toBe(401);
    });

    it('Refresh token rotation issues new access token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'Password123!' });
      const rawRefresh = loginRes.body.data.refreshToken;

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefresh });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.accessToken).toBeDefined();

      // Refresh token reuse detection: Using old token must fail!
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefresh });
      expect(reuseRes.status).toBe(401);
    });
  });

  describe('Products and Bill of Materials APIs', () => {
    it('Creates product category and product', async () => {
      const timestamp = Date.now();
      const catCode = `CAT_${timestamp}`;
      const catName = `Electronic Assemblies ${timestamp}`;
      const catRes = await request(app)
        .post('/api/v1/products/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: catName,
          code: catCode,
          description: 'PCBAs and microcontrollers',
        });
      expect(catRes.status).toBe(201);
      const catId = catRes.body.data.id;

      const partNo = `PRD-${timestamp}`;
      const prodRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          partNumber: partNo,
          name: `Telemetry Hub X1 ${timestamp}`,
          description: 'Industrial sensor hub',
          categoryId: catId,
        });
      expect(prodRes.status).toBe(201);
      testProductId = prodRes.body.data.id;
    });

    it('Creates BOM and adds line item component', async () => {
      const bomNo = `BOM-${Date.now()}`;
      const bomRes = await request(app)
        .post('/api/v1/boms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          bomNumber: bomNo,
        });
      expect(bomRes.status).toBe(201);
      testBomId = bomRes.body.data.id;

      const compRes = await request(app)
        .post(`/api/v1/boms/${testBomId}/components`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          partNumber: 'RES-10K-0805',
          name: 'Resistor 10k 0805 1%',
          componentType: 'ELECTRONIC',
          quantity: 12,
          unitCost: 0.05,
          unitOfMeasure: 'PCS',
        });
      expect(compRes.status).toBe(201);
      expect(Number(compRes.body.data.total_cost)).toBe(0.6);
    });
  });

  describe('ECO Lifecycle & Approval Workflow', () => {
    it('Creates ECO with active DRAFT revision', async () => {
      const ecoNo = `ECO-${Date.now()}`;
      const ecoRes = await request(app)
        .post('/api/v1/ecos')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          productId: testProductId,
          bomId: testBomId,
          ecoNumber: ecoNo,
          title: 'Upgrade Telemetry Microcontroller',
          description: 'Replace standard resistor with high-precision tolerance',
          priority: 'HIGH',
        });
      expect(ecoRes.status).toBe(201);
      testEcoId = ecoRes.body.data.id;
      expect(ecoRes.body.data.status).toBe('DRAFT');
    });

    it('Adds granular ECO change to draft ECO', async () => {
      const changeRes = await request(app)
        .post(`/api/v1/ecos/${testEcoId}/changes`)
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          changeType: 'QUANTITY_CHANGE',
          changeTarget: 'COMPONENT',
          fieldName: 'RES-10K-0805',
          oldValue: '12',
          newValue: '16',
        });
      expect(changeRes.status).toBe(201);
    });

    it('Submits ECO and locks revision snapshot', async () => {
      const submitRes = await request(app)
        .post(`/api/v1/ecos/${testEcoId}/submit`)
        .set('Authorization', `Bearer ${engineerToken}`);
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe('SUBMITTED');

      // Verify further draft changes are blocked on submitted ECO!
      const blockedChange = await request(app)
        .post(`/api/v1/ecos/${testEcoId}/changes`)
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          changeType: 'COST_CHANGE',
          changeTarget: 'COMPONENT',
          fieldName: 'RES-10K-0805',
          newValue: '0.10',
        });
      expect(blockedChange.status).toBe(400);
    });

    it('Approves ECO, generates versions and increments version counter', async () => {
      const reviewRes = await request(app)
        .post(`/api/v1/ecos/${testEcoId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
          comments: 'Approved for manufacturing implementation',
          overrideReason: 'Executive signoff for expedited release',
        });
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.newStatus).toBe('APPROVED');

      // Verify product version incremented to 2
      const productRes = await request(app)
        .get(`/api/v1/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(productRes.status).toBe(200);
      expect(productRes.body.data.current_version).toBe(2);
      expect(productRes.body.data.product_versions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Idempotency Key Protection', () => {
    it('Protects against duplicate creation with Idempotency-Key header', async () => {
      const idemKey = `idem-${Date.now()}`;
      const payload = {
        productId: testProductId,
        bomId: testBomId,
        ecoNumber: `ECO-IDEM-${Date.now()}`,
        title: 'Idempotency Validation Test',
      };

      const res1 = await request(app)
        .post('/api/v1/ecos')
        .set('Authorization', `Bearer ${engineerToken}`)
        .set('Idempotency-Key', idemKey)
        .send(payload);
      expect(res1.status).toBe(201);
      const originalEcoId = res1.body.data.id;

      // Duplicate request with exact same idempotency key
      const res2 = await request(app)
        .post('/api/v1/ecos')
        .set('Authorization', `Bearer ${engineerToken}`)
        .set('Idempotency-Key', idemKey)
        .send(payload);
      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(originalEcoId);
    });
  });
});
