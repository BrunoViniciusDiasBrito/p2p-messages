import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ApproveContactRequestUseCase,
  BlockPeerUseCase,
  CompactInboxReplayMetadataUseCase,
  CreateApiTokenUseCase,
  CreateLocalIdentityUseCase,
  DefaultIntegrationAuthorizer,
  ExportPublicIdentityUseCase,
  ListContactsUseCase,
  ListConversationsUseCase,
  ListMessagesUseCase,
  ListNotificationsUseCase,
  MarkNotificationAsReadUseCase,
  DirectMessageIncomingEnvelopeProcessor,
  PeerNodeEnvelopePublisher,
  RejectContactRequestUseCase,
  ReceiveDirectMessageUseCase,
  RegisterExternalApplicationUseCase,
  SendContactRequestUseCase,
  SendDirectMessageUseCase,
  SendMessageFromExternalAppUseCase,
  SubscribeExternalAppToEventsUseCase,
  RetryOutboxMessagesUseCase,
  type ApiTokenHasher,
  type ApiTokenSecretGenerator,
  type DomainEventBus,
  type ExternalAppEventSubscriptionPort,
  type IdGenerator,
  type IncomingEnvelopeProcessorPort
} from '@peercomms/application';
import { Notification, type DomainEvent, type IntegrationEventType, type IntegrationPermissionScope, type NotificationType, type PeerReachabilityStatus } from '@peercomms/domain';
import { type EncryptedVaultBackup, PersistentWebCryptoKeyStore, WebCryptoDirectMessageCrypto, WebCryptoEncryptedJsonVault, WebCryptoIdentityKeyProvider } from '@peercomms/crypto';
import { LocalApiHttpHandler } from '@peercomms/integration-api';
import { Libp2pPeerNodeRuntime, type Libp2pPeerNodeOptions, type Libp2pRuntimeEvent } from '@peercomms/p2p-libp2p';
import {
  type NodeSqlitePersistenceOptions,
  SqliteApiTokenRepository,
  SqliteContactRepository,
  SqliteContactRequestRepository,
  SqliteConversationRepository,
  SqliteEncryptedVaultStorage,
  SqliteExternalApplicationRepository,
  SqliteIdentityRepository,
  SqliteInboxRepository,
  SqliteMessageRepository,
  SqliteNetworkPeerProjection,
  SqliteNotificationRepository,
  SqliteOutboxRepository,
  SqliteWebhookSubscriptionRepository,
  openNodeSqlitePersistence
} from '@peercomms/storage-sqlite';
import { PeerCommsDaemon, type DaemonTimerPort, type LoopbackServerPort } from './daemon.js';
import { InboxReplayCompactionTask } from './inbox-replay-compaction-task.js';
import { FixedWindowLocalRateLimiter, type LocalRateLimiterOptions } from './local-rate-limiter.js';
import { NodeLoopbackServer } from './node-loopback-server.js';

export interface LocalDaemonRuntimeOptions {
  readonly port: number;
  readonly database: NodeSqlitePersistenceOptions;
  readonly vaultPassphrase: string;
  readonly deviceName?: string;
  readonly rateLimit?: LocalRateLimiterOptions;
  readonly p2p?: {
    readonly enabled?: boolean;
    readonly mode?: 'local_lan' | 'internet_p2p' | 'degraded' | 'relay_optional';
    readonly options?: Omit<Libp2pPeerNodeOptions, 'onRuntimeEvent'>;
  };
  readonly server?: LoopbackServerPort;
  readonly timer?: DaemonTimerPort;
}

export interface LocalDaemonRuntime {
  readonly daemon: PeerCommsDaemon;
  readonly api: LocalApiHttpHandler;
  readonly keyStore: PersistentWebCryptoKeyStore;
  start(): Promise<{ url: string }>;
  stop(): Promise<void>;
  lockVault(): void;
  exportEncryptedVaultBackup(): Promise<EncryptedVaultBackup>;
  restoreEncryptedVaultBackup(backup: EncryptedVaultBackup, options?: { overwrite?: boolean }): Promise<void>;
  rotateVaultPassphrase(nextPassphrase: string): Promise<void>;
  registerPeerTransport(input: { peerId: string; multiaddrs: readonly string[] }): void;
  configurePeerCrypto(input: { peerId: string; publicKey: string; sharedSecret: Uint8Array }): Promise<void>;
}

export async function createLocalDaemonRuntime(options: LocalDaemonRuntimeOptions): Promise<LocalDaemonRuntime> {
  const persistence = await openNodeSqlitePersistence(options.database);
  const database = persistence.database;
  const identityRepository = new SqliteIdentityRepository(database);
  const contacts = new SqliteContactRepository(database);
  const contactRequests = new SqliteContactRequestRepository(database);
  const conversations = new SqliteConversationRepository(database);
  const messages = new SqliteMessageRepository(database);
  const outbox = new SqliteOutboxRepository(database);
  const inbox = new SqliteInboxRepository(database);
  const apps = new SqliteExternalApplicationRepository(database);
  const tokens = new SqliteApiTokenRepository(database);
  const webhooks = new SqliteWebhookSubscriptionRepository(database);
  const notifications = new SqliteNotificationRepository(database);
  const networkPeers = new SqliteNetworkPeerProjection(database);

  const vault = new WebCryptoEncryptedJsonVault(new SqliteEncryptedVaultStorage(database));
  const keyStore = new PersistentWebCryptoKeyStore(vault, options.vaultPassphrase);
  const identityKeys = new WebCryptoIdentityKeyProvider(keyStore);
  const directMessageCrypto = new WebCryptoDirectMessageCrypto(keyStore);
  const ids = new NodeIdGenerator();
  const events = new SseDomainEventBus(notifications, webhooks);
  const createIdentity = new CreateLocalIdentityUseCase(identityKeys, identityRepository, events, ids);
  const sendDirectMessage = new SendDirectMessageUseCase(contacts, conversations, messages, outbox, directMessageCrypto, events, ids);
  const receiveDirectMessage = new ReceiveDirectMessageUseCase(contacts, conversations, messages, inbox, directMessageCrypto, events, ids);
  const incoming = new DeferredIncomingEnvelopeProcessor(receiveDirectMessage);
  const p2p = options.p2p?.enabled === false ? undefined : new Libp2pPeerNodeRuntime(incoming, {
    ...options.p2p?.options,
    onRuntimeEvent: (event) => { void projectLibp2pEvent(event, networkPeers, events); }
  });
  const tokenHasher = new NodeApiTokenHasher();
  const authorizer = new DefaultIntegrationAuthorizer(apps, tokens, tokenHasher);
  const externalEventSubscriptions = new NoopExternalEventSubscriptions();

  const api = new LocalApiHttpHandler({
    registerExternalApplication: new RegisterExternalApplicationUseCase(apps, events, ids),
    createApiToken: {
      execute: (input) => new CreateApiTokenUseCase(apps, tokens, new NodeApiTokenSecrets(), tokenHasher, ids)
        .execute({ appId: input.appId, scopes: input.scopes as readonly IntegrationPermissionScope[] })
    },
    exportPublicIdentity: new ExportPublicIdentityUseCase(identityRepository),
    listContacts: new ListContactsUseCase(contacts),
    sendContactRequest: new SendContactRequestUseCase(contactRequests, events, ids),
    approveContactRequest: new ApproveContactRequestUseCase(contactRequests, contacts, events, ids),
    rejectContactRequest: new RejectContactRequestUseCase(contactRequests),
    blockPeer: new BlockPeerUseCase(contacts, events, ids),
    listConversations: new ListConversationsUseCase(conversations),
    listMessages: new ListMessagesUseCase(messages),
    listNotifications: new ListNotificationsUseCase(notifications),
    markNotificationAsRead: new MarkNotificationAsReadUseCase(notifications),
    listNetworkPeers: { async execute({ limit } = {}) { return { ok: true, value: await networkPeers.list(limit) }; } },
    sendMessageFromExternalApp: new SendMessageFromExternalAppUseCase(
      authorizer,
      new FixedWindowLocalRateLimiter(options.rateLimit),
      { send: (input) => sendDirectMessage.execute(input) }
    ),
    subscribeExternalAppToEvents: new SubscribeExternalAppToEventsUseCase(authorizer, webhooks, externalEventSubscriptions, ids)
  });
  events.bind(api);

  const daemon = new PeerCommsDaemon({
    port: options.port,
    api,
    migrations: persistence.migrations,
    server: options.server ?? new NodeLoopbackServer(),
    resources: [...(p2p ? [{ close: () => p2p.stop() }] : []), persistence],
    startupTasks: [{
      name: 'ensure-local-identity',
      run: async () => {
        if (await identityRepository.getLocal()) return;
        const result = await createIdentity.execute({ deviceName: options.deviceName ?? 'PeerComms daemon' });
        if (!result.ok) throw result.error;
      }
    }, ...(p2p ? [{
      name: 'start-libp2p',
      run: async () => {
        const identity = await identityRepository.getLocal();
        if (!identity) throw new Error('Local identity must be initialized before starting libp2p');
        incoming.setLocalPeerId(identity.props.peerId.value);
        await p2p.start({ localPeerId: identity.props.peerId.value, mode: options.p2p?.mode ?? 'local_lan' });
      }
    }] : [])],
    maintenanceTasks: [
      new InboxReplayCompactionTask(new CompactInboxReplayMetadataUseCase(inbox)),
      ...(p2p ? [new OutboxDeliveryTask(new RetryOutboxMessagesUseCase(outbox, new PeerNodeEnvelopePublisher(p2p)))] : [])
    ],
    ...(options.timer === undefined ? {} : { timer: options.timer })
  });

  return {
    daemon,
    api,
    keyStore,
    start: () => daemon.start(),
    stop: () => daemon.stop(),
    lockVault: () => keyStore.lock(),
    exportEncryptedVaultBackup: () => vault.exportEncryptedBackup(),
    restoreEncryptedVaultBackup: (backup, restoreOptions) => vault.restoreEncryptedBackup(backup, restoreOptions),
    rotateVaultPassphrase: (nextPassphrase) => keyStore.rotatePassphrase(nextPassphrase),
    registerPeerTransport: (input) => {
      if (!p2p) throw new Error('libp2p is disabled for this daemon runtime');
      p2p.registerPeer(input);
    },
    async configurePeerCrypto(input) {
      const localIdentity = await identityRepository.getLocal();
      if (!localIdentity) throw new Error('Local identity must be initialized before configuring peer cryptography');
      await keyStore.registerPublicIdentity({ peerId: input.peerId, publicKey: input.publicKey });
      await keyStore.registerSharedSecret({ leftPeerId: localIdentity.props.peerId.value, rightPeerId: input.peerId, secret: input.sharedSecret });
    }
  };
}

class DeferredIncomingEnvelopeProcessor implements IncomingEnvelopeProcessorPort {
  private localPeerId: string | null = null;

  constructor(private readonly receive: ReceiveDirectMessageUseCase) {}

  setLocalPeerId(peerId: string): void {
    this.localPeerId = peerId;
  }

  async handle(input: { envelopeJson: string; receivedAt: Date }): Promise<void> {
    if (!this.localPeerId) throw new Error('libp2p received an envelope before local identity initialization');
    await new DirectMessageIncomingEnvelopeProcessor(this.localPeerId, this.receive).handle(input);
  }
}

class OutboxDeliveryTask {
  readonly name = 'deliver-outbox-through-libp2p';
  readonly intervalMs = 2_000;

  constructor(private readonly retry: RetryOutboxMessagesUseCase) {}

  async run(): Promise<void> {
    const result = await this.retry.execute({});
    if (!result.ok) throw result.error;
  }
}

async function projectLibp2pEvent(event: Libp2pRuntimeEvent, projection: SqliteNetworkPeerProjection, events: DomainEventBus): Promise<void> {
  const reachability: PeerReachabilityStatus = event.type === 'peer.disconnected' ? 'peer_unreachable' : 'peer_reachable';
  const peerId = `transport:${event.transportPeerId}`;
  await projection.upsert({ peerId, reachability, lastSeenAt: event.at.toISOString(), metadata: { transportPeerId: event.transportPeerId } });
  const name = event.type === 'peer.discovered' ? 'PeerDiscovered' : event.type === 'peer.connected' ? 'PeerConnected' : 'PeerDisconnected';
  await events.publish([{ id: `evt_${event.type.replaceAll('.', '_')}_${event.at.getTime()}_${event.transportPeerId}`, name, occurredAt: event.at, payload: { peerId } }]);
}

class NodeIdGenerator implements IdGenerator {
  newId(prefix = 'id'): string {
    return `${prefix}_${randomUUID().replaceAll('-', '')}`;
  }
}

class NodeApiTokenSecrets implements ApiTokenSecretGenerator {
  generateTokenSecret(): string {
    return randomBytes(32).toString('base64url');
  }
}

class NodeApiTokenHasher implements ApiTokenHasher {
  async hash(rawToken: string): Promise<string> {
    return `sha256:${createHash('sha256').update(rawToken).digest('base64url')}`;
  }
}

class SseDomainEventBus implements DomainEventBus {
  private api: LocalApiHttpHandler | null = null;

  constructor(
    private readonly notifications: SqliteNotificationRepository,
    private readonly webhooks: SqliteWebhookSubscriptionRepository
  ) {}

  bind(api: LocalApiHttpHandler): void {
    this.api = api;
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.api?.publishEvent({ id: event.id, type: event.name, data: { occurredAt: event.occurredAt.toISOString(), payload: event.payload } });
      await this.publishWebhooks(event, eventTypeForDomainEvent(event));
      const projection = notificationProjection(event);
      if (!projection) continue;
      const notification = Notification.create({
        id: `ntf_${event.id}`,
        type: projection.type,
        title: projection.title,
        ...(projection.body ? { body: projection.body } : {}),
        channels: ['desktop_local', 'in_app', 'local_api_event', 'local_sse'],
        createdAt: event.occurredAt
      }, `evt_ntf_${event.id}`);
      await this.notifications.save(notification);
      this.api?.publishEvent({ id: notification.snapshot.id, type: 'notification.created', data: notification.snapshot });
      await this.publishWebhooks({ id: notification.snapshot.id, name: 'NotificationCreated', occurredAt: event.occurredAt, payload: notification.snapshot }, 'notification.created');
    }
  }

  private async publishWebhooks(event: DomainEvent, eventType: IntegrationEventType | null): Promise<void> {
    if (!eventType) return;
    const subscriptions = await this.webhooks.listAll();
    await Promise.allSettled(subscriptions
      .filter((subscription) => subscription.snapshot.eventTypes.includes(eventType))
      .map(async (subscription) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2_000);
        try {
          await fetch(subscription.snapshot.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: event.id, type: eventType, occurredAt: event.occurredAt.toISOString(), payload: event.payload }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }
      }));
  }
}

function eventTypeForDomainEvent(event: DomainEvent): IntegrationEventType | null {
  switch (event.name) {
    case 'ContactRequestReceived': return 'contact.request.received';
    case 'ContactRequestApproved': return 'contact.request.approved';
    case 'DirectMessageReceived': return 'message.received';
    case 'DirectMessageQueued': return 'message.sent';
    case 'GroupInvitationReceived': return 'group.invitation.received';
    case 'GroupMemberAdded': return 'group.member.added';
    case 'PeerConnected': return 'peer.connected';
    case 'PeerDisconnected': return 'peer.disconnected';
    default: return null;
  }
}

function notificationProjection(event: DomainEvent): { type: NotificationType; title: string; body?: string } | null {
  const peerId = typeof event.payload === 'object' && event.payload !== null && 'peerId' in event.payload
    ? String((event.payload as { peerId: unknown }).peerId)
    : undefined;
  switch (event.name) {
    case 'DirectMessageReceived': return { type: 'message.received', title: 'Nova mensagem recebida', ...(peerId ? { body: `Mensagem de ${peerId}` } : {}) };
    case 'ContactRequestReceived': return { type: 'contact.request.received', title: 'Nova solicitacao de contato', ...(peerId ? { body: `Solicitacao de ${peerId}` } : {}) };
    case 'ContactRequestApproved': return { type: 'contact.request.approved', title: 'Contato aprovado', ...(peerId ? { body: `${peerId} agora faz parte dos seus contatos` } : {}) };
    case 'GroupInvitationReceived': return { type: 'group.invitation.received', title: 'Convite para grupo recebido' };
    case 'GroupMemberAdded': return { type: 'group.member.added', title: 'Novo participante no grupo', ...(peerId ? { body: peerId } : {}) };
    case 'PeerConnected': return { type: 'peer.connected', title: 'Peer conectado', ...(peerId ? { body: peerId } : {}) };
    case 'PeerDisconnected': return { type: 'peer.disconnected', title: 'Peer desconectado', ...(peerId ? { body: peerId } : {}) };
    default: return null;
  }
}

class NoopExternalEventSubscriptions implements ExternalAppEventSubscriptionPort {
  async subscribe(): Promise<void> {}
}
