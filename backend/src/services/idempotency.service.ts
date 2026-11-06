import { prisma } from '../config/database.js';
import { ConflictError, AppError } from '../utils/errors.js';
import crypto from 'crypto';
import { randomUUID } from 'crypto';

export interface IdempotencyContext {
  scope: string;
  key: string;
  actorId: string;
  requestPayload: any;
  resourceId?: string;
}

export class IdempotencyService {
  public static calculateHash(payload: any): string {
    const serialized = JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  public static async execute<T>(
    context: IdempotencyContext,
    operation: () => Promise<T>
  ): Promise<{ data: T; isCached: boolean }> {
    const requestHash = this.calculateHash(context.requestPayload);
    const leaseExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min lease
    const claimToken = randomUUID();

    // 1. Try reserving idempotency slot atomically
    let record = await prisma.idempotencyKey.findUnique({
      where: {
        scope_key: {
          scope: context.scope,
          key: context.key,
        },
      },
    });

    if (record) {
      // Validate request hash to detect payload tampering with same idempotency key
      if (record.request_hash !== requestHash) {
        throw new ConflictError(
          'Idempotency key reused with different request payload (request hash mismatch)'
        );
      }

      // If already completed, return cached response
      if (record.status === 'COMPLETED' && record.response_body) {
        return {
          data: record.response_body as unknown as T,
          isCached: true,
        };
      }

      // If still processing, check if lease expired
      if (record.status === 'PROCESSING') {
        if (record.lease_expires > new Date()) {
          throw new ConflictError('Concurrent request with this idempotency key is currently processing');
        }

        // Stale lease reclamation: take over processing
        await prisma.idempotencyKey.update({
          where: { id: record.id },
          data: {
            claim_token: claimToken,
            lease_expires: leaseExpires,
          },
        });
      }
    } else {
      // Create new reservation
      record = await prisma.idempotencyKey.create({
        data: {
          id: randomUUID(),
          scope: context.scope,
          key: context.key,
          actor_id: context.actorId,
          resource_id: context.resourceId,
          request_hash: requestHash,
          status: 'PROCESSING',
          lease_expires: leaseExpires,
          claim_token: claimToken,
        },
      });
    }

    // 2. Perform business operation
    try {
      const result = await operation();

      // 3. Mark completed and store response payload
      await prisma.idempotencyKey.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          response_body: result as any,
          completed_at: new Date(),
        },
      });

      return { data: result, isCached: false };
    } catch (error) {
      // On operational failure, remove reservation so user can safely retry
      await prisma.idempotencyKey.delete({
        where: { id: record.id },
      }).catch(() => {});
      throw error;
    }
  }
}
