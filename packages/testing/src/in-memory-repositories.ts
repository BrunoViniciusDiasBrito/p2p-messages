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
