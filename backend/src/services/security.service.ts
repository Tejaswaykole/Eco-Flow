import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import crypto from 'crypto';
import { config } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
}

export class SecurityService {
  public static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  public static async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  public static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  public static verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
  }

  public static generateRefreshToken(): { token: string; hash: string } {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { token: rawToken, hash };
  }

  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
