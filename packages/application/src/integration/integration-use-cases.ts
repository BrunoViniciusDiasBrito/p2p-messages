import { ApiToken, ExternalApplication, IntegrationEventType, IntegrationPermissionScope, PermissionGrant, Result, WebhookSubscription, err, ok } from '@peercomms/domain';
import { DomainEventBus } from '../ports/event-bus.js';
import { IdGenerator } from '../ports/id-generator.js';
import { ApiTokenHasher, ApiTokenRepository, ApiTokenSecretGenerator, ExternalApplicationRepository, ExternalAppEventSubscriptionPort, ExternalDirectMessageSenderPort, IntegrationAuthorizer, LocalIntegrationRateLimiter, WebhookSubscriptionRepository } from '../ports/integration-ports.js';

export class RegisterExternalApplicationUseCase {
  constructor(private readonly apps: ExternalApplicationRepository, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}

  async execute(input: { name: string }): Promise<Result<{ appId: string }>> {
    const now = new Date();
    const app = ExternalApplication.register({ id: this.ids.newId('app'), name: input.name, createdAt: now }, this.ids.newId('evt'));
    await this.apps.save(app);
    await this.events.publish(app.pullDomainEvents());
    return ok({ appId: app.snapshot.id });
  }
}

export class CreateApiTokenUseCase {
  constructor(
    private readonly apps: ExternalApplicationRepository,
    private readonly tokens: ApiTokenRepository,
    private readonly secrets: ApiTokenSecretGenerator,
    private readonly hasher: ApiTokenHasher,
    private readonly ids: IdGenerator
  ) {}

  async execute(input: { appId: string; scopes: readonly IntegrationPermissionScope[] }): Promise<Result<{ tokenId: string; token: string; scopes: readonly IntegrationPermissionScope[] }>> {
    const app = await this.apps.findById(input.appId);
    if (!app?.isActive()) return err(new Error('External application not found or revoked'));
    const rawToken = this.secrets.generateTokenSecret();
    const permissions = PermissionGrant.create(input.scopes);
    const token = ApiToken.issue({ id: this.ids.newId('tok'), appId: input.appId, tokenHash: await this.hasher.hash(rawToken), permissions, createdAt: new Date() });
    await this.tokens.save(token);
    return ok({ tokenId: token.snapshot.id, token: rawToken, scopes: token.snapshot.permissions.scopes });
  }
}

export class RevokeApiTokenUseCase {
  constructor(private readonly tokens: ApiTokenRepository) {}
  async execute(input: { tokenId: string }): Promise<Result<void>> {
    const token = await this.tokens.findById(input.tokenId);
    if (!token) return err(new Error('API token not found'));
    token.revoke(new Date());
    await this.tokens.save(token);
    return ok(undefined);
  }
}

export class DefaultIntegrationAuthorizer implements IntegrationAuthorizer {
  constructor(private readonly apps: ExternalApplicationRepository, private readonly tokens: ApiTokenRepository, private readonly hasher: ApiTokenHasher) {}

  async authorize(rawToken: string, requiredScope: IntegrationPermissionScope): Promise<Result<{ app: ExternalApplication; token: ApiToken }>> {
    const token = await this.tokens.findByHash(await this.hasher.hash(rawToken));
    if (!token?.allows(requiredScope)) return err(new Error('Invalid token or missing permission scope'));
    const app = await this.apps.findById(token.snapshot.appId);
    if (!app?.isActive()) return err(new Error('External application not found or revoked'));
    return ok({ app, token });
  }
}

export class SendMessageFromExternalAppUseCase {
  constructor(private readonly auth: IntegrationAuthorizer, private readonly rateLimiter: LocalIntegrationRateLimiter, private readonly sender: ExternalDirectMessageSenderPort) {}

  async execute(input: { token: string; fromPeerId: string; toPeerId: string; text: string }): Promise<Result<{ messageId: string; envelopeId: string }>> {
    const authorized = await this.auth.authorize(input.token, 'messages:send');
    if (!authorized.ok) return authorized;
    const allowed = await this.rateLimiter.consume({ appId: authorized.value.app.snapshot.id, action: 'messages:send' });
    if (!allowed) return err(new Error('Local integration rate limit exceeded'));
    return this.sender.send({ fromPeerId: input.fromPeerId, toPeerId: input.toPeerId, text: input.text });
  }
}

export class SubscribeExternalAppToEventsUseCase {
  constructor(
    private readonly auth: IntegrationAuthorizer,
    private readonly webhooks: WebhookSubscriptionRepository,
    private readonly subscriptions: ExternalAppEventSubscriptionPort,
    private readonly ids: IdGenerator
  ) {}

  async execute(input: { token: string; webhookUrl: string; eventTypes: readonly IntegrationEventType[] }): Promise<Result<{ subscriptionId: string }>> {
    const authorized = await this.auth.authorize(input.token, 'notifications:subscribe');
    if (!authorized.ok) return authorized;
    const subscription = WebhookSubscription.create({ id: this.ids.newId('wh'), appId: authorized.value.app.snapshot.id, url: input.webhookUrl, eventTypes: input.eventTypes, createdAt: new Date() });
    await this.webhooks.save(subscription);
    await this.subscriptions.subscribe({ appId: subscription.snapshot.appId, eventTypes: subscription.snapshot.eventTypes });
    return ok({ subscriptionId: subscription.snapshot.id });
  }
}
