import { ApiToken, ExternalApplication, IntegrationEventType, IntegrationPermissionScope, Result, WebhookSubscription } from '@peercomms/domain';

export interface ExternalApplicationRepository {
  save(app: ExternalApplication): Promise<void>;
  findById(appId: string): Promise<ExternalApplication | null>;
  list(): Promise<ExternalApplication[]>;
}

export interface ApiTokenRepository {
  save(token: ApiToken): Promise<void>;
  findById(tokenId: string): Promise<ApiToken | null>;
  findByHash(tokenHash: string): Promise<ApiToken | null>;
}

export interface WebhookSubscriptionRepository {
  save(subscription: WebhookSubscription): Promise<void>;
  listByAppId(appId: string): Promise<WebhookSubscription[]>;
}

export interface ApiTokenSecretGenerator {
  generateTokenSecret(): string;
}

export interface ApiTokenHasher {
  hash(rawToken: string): Promise<string>;
}

export interface LocalIntegrationRateLimiter {
  consume(input: { appId: string; action: string }): Promise<boolean>;
}

export interface ExternalAppEventSubscriptionPort {
  subscribe(input: { appId: string; eventTypes: readonly IntegrationEventType[] }): Promise<void>;
}

export interface ExternalDirectMessageSenderPort {
  send(input: { fromPeerId: string; toPeerId: string; text: string }): Promise<Result<{ messageId: string; envelopeId: string }>>;
}

export interface AuthenticatedExternalApp {
  readonly app: ExternalApplication;
  readonly token: ApiToken;
}

export interface IntegrationAuthorizer {
  authorize(rawToken: string, requiredScope: IntegrationPermissionScope): Promise<Result<AuthenticatedExternalApp>>;
}
