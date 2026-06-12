import { DomainError } from '../shared/domain-error.js';
import { IntegrationPermissionScope, PermissionGrant } from './permissions.js';

export interface ApiTokenProps {
  readonly id: string;
  readonly appId: string;
  readonly tokenHash: string;
  readonly permissions: PermissionGrant;
  readonly createdAt: Date;
  readonly revokedAt?: Date;
}

export class ApiToken {
  private props: ApiTokenProps;
  private constructor(props: ApiTokenProps) { this.props = props; }

  static issue(props: ApiTokenProps): ApiToken {
    if (!props.tokenHash.startsWith('tokhash_')) throw new DomainError('API token hash must be stored as a hash reference, not raw token', 'api_token.hash_invalid');
    return new ApiToken(props);
  }

  static rehydrate(props: ApiTokenProps): ApiToken { return new ApiToken(props); }

  revoke(now: Date): void { this.props = { ...this.props, revokedAt: now }; }
  isActive(): boolean { return !this.props.revokedAt; }
  allows(scope: IntegrationPermissionScope): boolean { return this.isActive() && this.props.permissions.allows(scope); }
  get snapshot(): ApiTokenProps { return this.props; }
}
