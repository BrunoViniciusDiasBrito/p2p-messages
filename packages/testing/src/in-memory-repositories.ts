import { Contact, ContactRequest, Identity, PeerId } from '@peercomms/domain';
import { ContactRepository, ContactRequestRepository, IdentityRepository } from '@peercomms/application';

export class InMemoryIdentityRepository implements IdentityRepository {
  private identity: Identity | null = null;
  async save(identity: Identity): Promise<void> { this.identity = identity; }
  async getLocal(): Promise<Identity | null> { return this.identity; }
}

export class InMemoryContactRequestRepository implements ContactRequestRepository {
  private readonly rows = new Map<string, ContactRequest>();
  async save(request: ContactRequest): Promise<void> { this.rows.set(request.snapshot.id.value, request); }
  async findById(id: string): Promise<ContactRequest | null> { return this.rows.get(id) ?? null; }
  async findPendingWithPeer(peerId: PeerId): Promise<ContactRequest | null> {
    return [...this.rows.values()].find((request) => request.snapshot.remotePeerId.value === peerId.value && request.snapshot.status.startsWith('pending')) ?? null;
  }
  async list(): Promise<ContactRequest[]> { return [...this.rows.values()]; }
}

export class InMemoryContactRepository implements ContactRepository {
  private readonly rows = new Map<string, Contact>();
  async save(contact: Contact): Promise<void> { this.rows.set(contact.snapshot.peerId.value, contact); }
  async findByPeerId(peerId: PeerId): Promise<Contact | null> { return this.rows.get(peerId.value) ?? null; }
  async list(): Promise<Contact[]> { return [...this.rows.values()]; }
}
import { Conversation, ConversationId, InboxEntry, Message, OutboxEntry } from '@peercomms/domain';
import { ConversationRepository, InboxRepository, MessageRepository, OutboxRepository } from '@peercomms/application';

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly rows = new Map<string, Conversation>();
  async save(conversation: Conversation): Promise<void> { this.rows.set(conversation.snapshot.id.value, conversation); }
  async findDirectByPeerId(peerId: PeerId): Promise<Conversation | null> {
    return [...this.rows.values()].find((conversation) => conversation.snapshot.type === 'direct' && conversation.snapshot.peerId?.value === peerId.value) ?? null;
  }
  async findById(id: ConversationId): Promise<Conversation | null> { return this.rows.get(id.value) ?? null; }
  async list(): Promise<Conversation[]> { return [...this.rows.values()]; }
}

export class InMemoryMessageRepository implements MessageRepository {
  private readonly rows = new Map<string, Message>();
  async save(message: Message): Promise<void> { this.rows.set(message.snapshot.id.value, message); }
  async findById(messageId: string): Promise<Message | null> { return this.rows.get(messageId) ?? null; }
  async listByConversationId(conversationId: ConversationId): Promise<Message[]> {
    return [...this.rows.values()].filter((message) => message.snapshot.conversationId.value === conversationId.value);
  }
}

export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly rows = new Map<string, OutboxEntry>();
  async save(entry: OutboxEntry): Promise<void> { this.rows.set(entry.snapshot.envelopeId, entry); }
  async findDue(now: Date, limit: number): Promise<OutboxEntry[]> {
    return [...this.rows.values()]
      .filter((entry) => ['queued_until_reachable', 'ready_to_publish'].includes(entry.snapshot.status) && (!entry.snapshot.nextAttemptAt || entry.snapshot.nextAttemptAt <= now))
      .slice(0, limit);
  }
  async list(): Promise<OutboxEntry[]> { return [...this.rows.values()]; }
}

export class InMemoryInboxRepository implements InboxRepository {
  private readonly rows = new Map<string, InboxEntry>();
  async save(entry: InboxEntry): Promise<void> { this.rows.set(entry.snapshot.envelopeId, entry); }
  async exists(envelopeId: string): Promise<boolean> { return this.rows.has(envelopeId); }
}
import { Group, GroupId, GroupInvitation } from '@peercomms/domain';
import { GroupInvitationRepository, GroupRepository } from '@peercomms/application';

export class InMemoryGroupRepository implements GroupRepository {
  private readonly rows = new Map<string, Group>();
  async save(group: Group): Promise<void> { this.rows.set(group.snapshot.id.value, group); }
  async findById(groupId: GroupId): Promise<Group | null> { return this.rows.get(groupId.value) ?? null; }
  async list(): Promise<Group[]> { return [...this.rows.values()]; }
}

export class InMemoryGroupInvitationRepository implements GroupInvitationRepository {
  private readonly rows = new Map<string, GroupInvitation>();
  async save(invitation: GroupInvitation): Promise<void> { this.rows.set(invitation.snapshot.id.value, invitation); }
  async findById(invitationId: string): Promise<GroupInvitation | null> { return this.rows.get(invitationId) ?? null; }
  async list(): Promise<GroupInvitation[]> { return [...this.rows.values()]; }
}
