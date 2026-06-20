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
  RejectContactRequestUseCase,
  RegisterExternalApplicationUseCase,
  SendContactRequestUseCase,
  SendDirectMessageUseCase,
  SendMessageFromExternalAppUseCase,
  SubscribeExternalAppToEventsUseCase,
  type ApiTokenHasher,
  type ApiTokenSecretGenerator,
  type DomainEventBus,
  type ExternalAppEventSubscriptionPort,
  type IdGenerator
} from '@peercomms/application';
import { type DomainEvent, type IntegrationPermissionScope } from '@peercomms/domain';
import { PersistentWebCryptoKeyStore, WebCryptoDirectMessageCrypto, WebCryptoEncryptedJsonVault, WebCryptoIdentityKeyProvider } from '@peercomms/crypto';
import { LocalApiHttpHandler } from '@peercomms/integration-api';
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
  readonly server?: LoopbackServerPort;
  readonly timer?: DaemonTimerPort;
}

export interface LocalDaemonRuntime {
  readonly daemon: PeerCommsDaemon;
  readonly api: LocalApiHttpHandler;
  readonly keyStore: PersistentWebCryptoKeyStore;
  start(): Promise<{ url: string }>;
  stop(): Promise<void>;
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

  const vault = new WebCryptoEncryptedJsonVault(new SqliteEncryptedVaultStorage(database));
  const keyStore = new PersistentWebCryptoKeyStore(vault, options.vaultPassphrase);
  const identityKeys = new WebCryptoIdentityKeyProvider(keyStore);
  const directMessageCrypto = new WebCryptoDirectMessageCrypto(keyStore);
  const ids = new NodeIdGenerator();
  const events = new SseDomainEventBus();
  const createIdentity = new CreateLocalIdentityUseCase(identityKeys, identityRepository, events, ids);
  const sendDirectMessage = new SendDirectMessageUseCase(contacts, conversations, messages, outbox, directMessageCrypto, events, ids);
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
    resources: [persistence],
    startupTasks: [{
      name: 'ensure-local-identity',
      run: async () => {
        if (await identityRepository.getLocal()) return;
        const result = await createIdentity.execute({ deviceName: options.deviceName ?? 'PeerComms daemon' });
        if (!result.ok) throw result.error;
      }
    }],
    maintenanceTasks: [new InboxReplayCompactionTask(new CompactInboxReplayMetadataUseCase(inbox))],
    ...(options.timer === undefined ? {} : { timer: options.timer })
  });

  return {
    daemon,
    api,
    keyStore,
    start: () => daemon.start(),
    stop: () => daemon.stop(),
    async configurePeerCrypto(input) {
      const localIdentity = await identityRepository.getLocal();
      if (!localIdentity) throw new Error('Local identity must be initialized before configuring peer cryptography');
      await keyStore.registerPublicIdentity({ peerId: input.peerId, publicKey: input.publicKey });
      await keyStore.registerSharedSecret({ leftPeerId: localIdentity.props.peerId.value, rightPeerId: input.peerId, secret: input.sharedSecret });
    }
  };
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

  bind(api: LocalApiHttpHandler): void {
    this.api = api;
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.api?.publishEvent({ id: event.id, type: event.name, data: { occurredAt: event.occurredAt.toISOString(), payload: event.payload } });
    }
  }
}

class NoopExternalEventSubscriptions implements ExternalAppEventSubscriptionPort {
  async subscribe(): Promise<void> {}
}
