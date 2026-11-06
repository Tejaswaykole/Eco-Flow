import { z } from 'zod';
import { UserStatus } from '@ecoflow/domain-types';

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address format')
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
  deviceName: z.string().max(100).optional(),
});

export const RegisterUserSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address format')
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
  roleId: z.string().uuid('Invalid role ID format').optional(),
  phone: z.string().max(25).optional(),
});

export const AccessRequestSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address format')
    .max(255, 'Email cannot exceed 255 characters'),
  requestedRole: z
    .string({ required_error: 'Requested role is required' })
    .min(2, 'Role must be at least 2 characters')
    .max(50, 'Role cannot exceed 50 characters'),
  department: z.string().max(100).optional(),
  reason: z.string().max(500).optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token cannot be empty').optional(),
});

export const UpdateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({ message: 'Invalid user status value' }),
  }),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type AccessRequestInput = z.infer<typeof AccessRequestSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;
