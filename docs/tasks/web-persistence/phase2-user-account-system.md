# Phase 2: User Account System

**Status**: Not Started  
**Estimated Effort**: 3-4 days  
**Dependencies**: Phase 1 (FileUserRepository)

## Overview

Implement user accounts with authentication and authorization. This phase enables multi-user access with proper identity management and access control.

---

## Objectives

1. Define User schema with secure password storage
2. Implement session-based authentication
3. Add role-based authorization for questionnaire operations

---

## 2.1 User Schema & Storage

### User Schema

Create `src/core/schemas/user.ts`:

```typescript
import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'creator', 'respondent']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string().min(60), // bcrypt hash length
  displayName: z.string().min(1).max(100).optional(),
  role: UserRoleSchema.default('respondent'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().optional(),
  emailVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type User = z.infer<typeof UserSchema>;

// Safe user object without password hash (for API responses)
export const SafeUserSchema = UserSchema.omit({ passwordHash: true });
export type SafeUser = z.infer<typeof SafeUserSchema>;
```

### User Storage

File structure in `data/users/`:
- One JSON file per user: `{userId}.json`
- Email index file: `_email-index.json` mapping emails to user IDs

### Email Uniqueness

Implement email uniqueness validation:
1. Check email index before creating user
2. Update email index atomically with user creation
3. Handle race conditions with file locking (Phase 1)

---

## 2.2 Authentication Layer

### Password Hashing

Create `src/core/auth/password-hasher.ts`:

```typescript
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

// bcrypt implementation
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private saltRounds: number = 12) {}
  
  async hash(password: string): Promise<string>;
  async verify(password: string, hash: string): Promise<boolean>;
}
```

Password requirements:
- Minimum 8 characters
- At least one uppercase, one lowercase, one digit
- bcrypt with salt rounds >= 12

### Session Management

Create `src/core/auth/session-manager.ts`:

```typescript
export interface Session {
  sessionId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
  lastActivityAt: number;
}

export interface SessionManager {
  createSession(userId: string, metadata?: SessionMetadata): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  validateSession(sessionId: string): Promise<boolean>;
  extendSession(sessionId: string): Promise<Session>;
  invalidateSession(sessionId: string): Promise<void>;
  invalidateAllUserSessions(userId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
}
```

Session storage: `data/sessions/` (extends existing session structure)

### Auth Service

Create `src/core/services/auth-service.ts`:

```typescript
export interface AuthService {
  // Registration
  register(email: string, password: string, displayName?: string): Promise<SafeUser>;
  
  // Login/Logout
  login(email: string, password: string): Promise<{ user: SafeUser; session: Session }>;
  logout(sessionId: string): Promise<void>;
  logoutAll(userId: string): Promise<void>;
  
  // Password management
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  
  // Session validation
  validateSession(sessionId: string): Promise<SafeUser | null>;
}
```

### Rate Limiting

Create `src/core/auth/rate-limiter.ts`:

```typescript
export interface RateLimiter {
  checkLimit(key: string): Promise<boolean>;
  recordAttempt(key: string): Promise<void>;
  resetLimit(key: string): Promise<void>;
}

// Configuration
export interface RateLimitConfig {
  maxAttempts: number;      // default: 5
  windowSeconds: number;    // default: 300 (5 minutes)
  lockoutSeconds: number;   // default: 900 (15 minutes)
}
```

Rate limit storage: `data/.rate-limits/` with JSON files per key.

### Password Reset Tokens

Create `src/core/auth/tokens.ts`:

```typescript
export interface TokenService {
  generateResetToken(userId: string): Promise<string>;
  validateResetToken(token: string): Promise<string | null>; // returns userId
  invalidateToken(token: string): Promise<void>;
  cleanupExpiredTokens(): Promise<number>;
}
```

Token storage: `data/.tokens/` with expiration (1 hour default).

---

## 2.3 Authorization

### Role Definitions

| Role | Permissions |
|------|-------------|
| admin | All operations on all questionnaires and users |
| creator | CRUD on own questionnaires, view own responses |
| respondent | Answer questionnaires, view own responses only |

### Permission Checks

Create `src/core/auth/authorization.ts`:

```typescript
export type Permission = 
  | 'questionnaire:create'
  | 'questionnaire:read'
  | 'questionnaire:update'
  | 'questionnaire:delete'
  | 'questionnaire:publish'
  | 'response:create'
  | 'response:read'
  | 'response:delete'
  | 'user:manage';

export interface AuthorizationService {
  hasPermission(user: SafeUser, permission: Permission, resourceOwnerId?: string): boolean;
  canAccessQuestionnaire(user: SafeUser, questionnaire: Questionnaire): boolean;
  canAccessResponse(user: SafeUser, response: QuestionnaireResponse): boolean;
}

// Permission matrix
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [/* all permissions */],
  creator: ['questionnaire:create', 'questionnaire:read', 'questionnaire:update', 
            'questionnaire:delete', 'questionnaire:publish', 'response:read'],
  respondent: ['questionnaire:read', 'response:create', 'response:read'],
};
```

### Ownership Validation

Add ownership tracking to questionnaires:

```typescript
// Extend QuestionnaireMetadataSchema
export const QuestionnaireMetadataSchema = z.object({
  // ... existing fields
  ownerId: z.string().uuid(),
  collaboratorIds: z.array(z.string().uuid()).optional(),
});
```

---

## File Structure

```
src/core/
├── schemas/
│   └── user.ts                 # User schema
├── auth/
│   ├── password-hasher.ts      # bcrypt implementation
│   ├── session-manager.ts      # Session CRUD
│   ├── rate-limiter.ts         # Login attempt limiting
│   ├── tokens.ts               # Password reset tokens
│   └── authorization.ts        # Permission checks
├── services/
│   └── auth-service.ts         # Authentication business logic
```

---

## Tasks

| Task ID | Description | Estimated Hours |
|---------|-------------|-----------------|
| 2.1.1 | Define User schema with Zod | 2 |
| 2.1.2 | Implement email index for uniqueness | 2 |
| 2.1.3 | Extend questionnaire schema with ownerId | 1 |
| 2.2.1 | Implement BcryptPasswordHasher | 2 |
| 2.2.2 | Implement SessionManager | 4 |
| 2.2.3 | Implement AuthService (register/login/logout) | 4 |
| 2.2.4 | Implement password reset flow | 3 |
| 2.2.5 | Implement RateLimiter | 2 |
| 2.3.1 | Define role permissions matrix | 1 |
| 2.3.2 | Implement AuthorizationService | 3 |
| 2.3.3 | Add ownership validation helpers | 2 |

**Total**: ~26 hours (3-4 days)

---

## New Dependencies

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6"
  }
}
```

---

## Testing Requirements

### Unit Tests

- User schema validation
- Password hashing and verification
- Session creation and validation
- Session expiration
- Rate limiting thresholds
- Permission checks for each role
- Ownership validation

### Integration Tests

- Full registration flow
- Full login flow with session creation
- Password reset flow
- Rate limiting with multiple attempts
- Session cleanup

### Security Tests

- Password strength validation
- Hash timing attacks (constant-time compare)
- Session fixation prevention
- Token expiration enforcement

---

## Acceptance Criteria

- [ ] Users can register with email and password
- [ ] Passwords are securely hashed with bcrypt
- [ ] Users can log in and receive session
- [ ] Sessions expire after configured time
- [ ] Failed login attempts are rate limited
- [ ] Password reset flow works end-to-end
- [ ] Role-based permissions are enforced
- [ ] Users can only access their own questionnaires
- [ ] Admin users can access all resources
- [ ] All existing tests pass

---

## Security Considerations

- Never log password hashes
- Use constant-time comparison for tokens
- Invalidate all sessions on password change
- Rate limit applies per email AND per IP
- Session IDs should be cryptographically random
- Set secure cookie flags when used in web context

---

## Notes

- bcryptjs chosen over bcrypt for pure JS implementation (no native dependencies)
- Salt rounds of 12 balances security and performance
- Session cleanup should run periodically (every hour)
- Consider adding account lockout after N failed attempts
