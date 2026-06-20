import { describe, expect, it } from 'vitest';
import { ApiToken, ExternalApplication, PermissionGrant, Result, WebhookSubscription, ok } from '@peercomms/domain';
import { CreateApiTokenUseCase, DefaultIntegrationAuthorizer, RegisterExternalApplicationUseCase, SendMessageFromExternalAppUseCase, SubscribeExternalAppToEventsUseCase, type ApiTokenHasher, type ApiTokenRepository, type ApiTokenSecretGenerator, type ExternalApplicationRepository, type ExternalAppEventSubscriptionPort, type ExternalDirectMessageSenderPort, type IdGenerator, type LocalIntegrationRateLimiter, type WebhookSubscriptionRepository, NoopDomainEventBus } from '../index.js';

class FixedIds implements IdGenerator {
  private next = 0;
  newId(prefix = 'id'): string { this.next += 1; return `${prefix}_${this.next}`; }
}

class Apps implements ExternalApplicationRepository {
  private readonly rows = new Map<string, ExternalApplication>();
  async save(app: ExternalApplication): Promise<void> { this.rows.set(app.snapshot.id, app); }
  async findById(appId: string): Promise<ExternalApplication | null> { return this.rows.get(appId) ?? null; }
  async list(): Promise<ExternalApplication[]> { return [...this.rows.values()]; }
}

class Tokens implements ApiTokenRepository {
  private readonly rows = new Map<string, ApiToken>();
  async save(token: ApiToken): Promise<void> { this.rows.set(token.snapshot.id, token); }
  async findById(tokenId: string): Promise<ApiToken | null> { return this.rows.get(tokenId) ?? null; }
  async findByHash(tokenHash: string): Promise<ApiToken | null> { return [...this.rows.values()].find((token) => token.snapshot.tokenHash === tokenHash) ?? null; }
}

class Webhooks implements WebhookSubscriptionRepository {
  readonly rows: WebhookSubscription[] = [];
  async save(subscription: WebhookSubscription): Promise<void> { this.rows.push(subscription); }
  async listByAppId(appId: string): Promise<WebhookSubscription[]> { return this.rows.filter((row) => row.snapshot.appId === appId); }
  async listAll(): Promise<WebhookSubscription[]> { return [...this.rows]; }
}

const hasher: ApiTokenHasher = { async hash(rawToken) { return `tokhash_${rawToken}`; } };
const secrets: ApiTokenSecretGenerator = { generateTokenSecret: () => 'raw_test_token' };
const limiter: LocalIntegrationRateLimiter = { async consume() { return true; } };
const sender: ExternalDirectMessageSenderPort = { async send(): Promise<Result<{ messageId: string; envelopeId: string }>> { return ok({ messageId: 'msg_1', envelopeId: 'env_1' }); } };
const subscriptions: ExternalAppEventSubscriptionPort = { async subscribe() {} };

describe('integration use cases', () => {
  it('registers an app, issues a scoped token, and authorizes send message', async () => {
    const apps = new Apps();
    const tokens = new Tokens();
    const ids = new FixedIds();
    const registered = await new RegisterExternalApplicationUseCase(apps, new NoopDomainEventBus(), ids).execute({ name: 'Local Bot' });
    expect(registered.ok).toBe(true);
    const appId = registered.ok ? registered.value.appId : '';
    const issued = await new CreateApiTokenUseCase(apps, tokens, secrets, hasher, ids).execute({ appId, scopes: ['messages:send', 'notifications:subscribe'] });
    expect(issued.ok).toBe(true);

    const auth = new DefaultIntegrationAuthorizer(apps, tokens, hasher);
    const sent = await new SendMessageFromExternalAppUseCase(auth, limiter, sender).execute({ token: 'raw_test_token', fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' });
    expect(sent.ok).toBe(true);
  });

  it('stores loopback webhook subscriptions for authorized apps', async () => {
    const apps = new Apps();
    const tokens = new Tokens();
    const webhooks = new Webhooks();
    const app = ExternalApplication.register({ id: 'app_1', name: 'Notifier', createdAt: new Date() }, 'evt_1');
    await apps.save(app);
    await tokens.save(ApiToken.issue({ id: 'tok_1', appId: 'app_1', tokenHash: 'tokhash_raw_test_token', permissions: PermissionGrant.create(['notifications:subscribe']), createdAt: new Date() }));
    const result = await new SubscribeExternalAppToEventsUseCase(new DefaultIntegrationAuthorizer(apps, tokens, hasher), webhooks, subscriptions, new FixedIds())
      .execute({ token: 'raw_test_token', webhookUrl: 'http://127.0.0.1:9000/hook', eventTypes: ['message.received'] });
    expect(result.ok).toBe(true);
    expect(webhooks.rows).toHaveLength(1);
  });
});
