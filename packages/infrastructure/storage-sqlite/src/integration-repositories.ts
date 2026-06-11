import { ApiToken, ExternalApplication, PermissionGrant, WebhookSubscription } from '@peercomms/domain';
import { ApiTokenRepository, ExternalApplicationRepository, WebhookSubscriptionRepository } from '@peercomms/application';
import { fromIso, SqliteDatabasePort, SqliteRow, toIso } from './database.js';

interface ExternalApplicationRow extends SqliteRow {
  id: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
}

interface ApiTokenRow extends SqliteRow {
  id: string;
  app_id: string;
  token_hash: string;
  scopes: string;
  created_at: string;
  revoked_at: string | null;
}

interface WebhookSubscriptionRow extends SqliteRow {
  id: string;
  app_id: string;
  url: string;
  event_types: string;
  created_at: string;
}

const parseJsonArray = <T>(value: string): T[] => JSON.parse(value) as T[];

const mapApp = (row: ExternalApplicationRow): ExternalApplication => ExternalApplication.rehydrate({
  id: row.id,
  name: row.name,
  createdAt: fromIso(row.created_at),
  ...(row.revoked_at ? { revokedAt: fromIso(row.revoked_at) } : {})
});

const mapToken = (row: ApiTokenRow): ApiToken => ApiToken.rehydrate({
  id: row.id,
  appId: row.app_id,
  tokenHash: row.token_hash,
  permissions: PermissionGrant.create(parseJsonArray(row.scopes)),
  createdAt: fromIso(row.created_at),
  ...(row.revoked_at ? { revokedAt: fromIso(row.revoked_at) } : {})
});

const mapWebhook = (row: WebhookSubscriptionRow): WebhookSubscription => WebhookSubscription.rehydrate({
  id: row.id,
  appId: row.app_id,
  url: row.url,
  eventTypes: parseJsonArray(row.event_types),
  createdAt: fromIso(row.created_at)
});

export class SqliteExternalApplicationRepository implements ExternalApplicationRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(app: ExternalApplication): Promise<void> {
    const snapshot = app.snapshot;
    await this.db.execute(
      `INSERT INTO external_apps (id, name, created_at, revoked_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, revoked_at = excluded.revoked_at`,
      [snapshot.id, snapshot.name, snapshot.createdAt.toISOString(), toIso(snapshot.revokedAt)]
    );
  }

  async findById(appId: string): Promise<ExternalApplication | null> {
    const row = await this.db.queryOne<ExternalApplicationRow>('SELECT id, name, created_at, revoked_at FROM external_apps WHERE id = ?', [appId]);
    return row ? mapApp(row) : null;
  }

  async list(): Promise<ExternalApplication[]> {
    const rows = await this.db.query<ExternalApplicationRow>('SELECT id, name, created_at, revoked_at FROM external_apps ORDER BY created_at DESC');
    return rows.map(mapApp);
  }
}

export class SqliteApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(token: ApiToken): Promise<void> {
    const snapshot = token.snapshot;
    await this.db.execute(
      `INSERT INTO api_tokens (id, app_id, token_hash, scopes, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET scopes = excluded.scopes, revoked_at = excluded.revoked_at`,
      [snapshot.id, snapshot.appId, snapshot.tokenHash, JSON.stringify(snapshot.permissions.scopes), snapshot.createdAt.toISOString(), toIso(snapshot.revokedAt)]
    );
  }

  async findById(tokenId: string): Promise<ApiToken | null> {
    const row = await this.db.queryOne<ApiTokenRow>('SELECT id, app_id, token_hash, scopes, created_at, revoked_at FROM api_tokens WHERE id = ?', [tokenId]);
    return row ? mapToken(row) : null;
  }

  async findByHash(tokenHash: string): Promise<ApiToken | null> {
    const row = await this.db.queryOne<ApiTokenRow>('SELECT id, app_id, token_hash, scopes, created_at, revoked_at FROM api_tokens WHERE token_hash = ?', [tokenHash]);
    return row ? mapToken(row) : null;
  }
}

export class SqliteWebhookSubscriptionRepository implements WebhookSubscriptionRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(subscription: WebhookSubscription): Promise<void> {
    const snapshot = subscription.snapshot;
    await this.db.execute(
      `INSERT INTO webhook_subscriptions (id, app_id, url, event_types, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET url = excluded.url, event_types = excluded.event_types`,
      [snapshot.id, snapshot.appId, snapshot.url, JSON.stringify(snapshot.eventTypes), snapshot.createdAt.toISOString()]
    );
  }

  async listByAppId(appId: string): Promise<WebhookSubscription[]> {
    const rows = await this.db.query<WebhookSubscriptionRow>('SELECT id, app_id, url, event_types, created_at FROM webhook_subscriptions WHERE app_id = ? ORDER BY created_at DESC', [appId]);
    return rows.map(mapWebhook);
  }
}
