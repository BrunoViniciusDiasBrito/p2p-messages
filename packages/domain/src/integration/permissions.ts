import { DomainError } from '../shared/domain-error.js';

export const integrationPermissionScopes = [
  'contacts:read',
  'messages:send',
  'messages:read',
  'groups:read',
  'groups:write',
  'notifications:subscribe',
  'identity:read_public'
] as const;

export type IntegrationPermissionScope = typeof integrationPermissionScopes[number];

export class PermissionGrant {
  private constructor(readonly scopes: readonly IntegrationPermissionScope[]) {}

  static create(scopes: readonly IntegrationPermissionScope[]): PermissionGrant {
    const unique = [...new Set(scopes)];
    if (unique.length === 0) throw new DomainError('At least one integration permission scope is required', 'permission_grant.empty');
    for (const scope of unique) {
      if (!integrationPermissionScopes.includes(scope)) throw new DomainError(`Unknown integration permission scope: ${scope}`, 'permission_grant.unknown_scope');
    }
    return new PermissionGrant(unique);
  }

  allows(scope: IntegrationPermissionScope): boolean {
    return this.scopes.includes(scope);
  }
}
