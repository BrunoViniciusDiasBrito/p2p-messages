import { describe, expect, it } from 'vitest';
import { ApproveContactRequestUseCase, CreateLocalIdentityUseCase, NoopDomainEventBus, SendContactRequestUseCase, type IdGenerator, type IdentityKeyProvider } from '../index.js';
import { Contact, ContactRequest, Identity, PeerId } from '@peercomms/domain';
import type { ContactRepository, ContactRequestRepository, IdentityRepository } from '../index.js';


class InMemoryIdentityRepository implements IdentityRepository {
  private identity: Identity | null = null;
  async save(identity: Identity): Promise<void> { this.identity = identity; }
  async getLocal(): Promise<Identity | null> { return this.identity; }
}

class InMemoryContactRequestRepository implements ContactRequestRepository {
  private readonly rows = new Map<string, ContactRequest>();
  async save(request: ContactRequest): Promise<void> { this.rows.set(request.snapshot.id.value, request); }
  async findById(id: string): Promise<ContactRequest | null> { return this.rows.get(id) ?? null; }
  async findPendingWithPeer(peerId: PeerId): Promise<ContactRequest | null> {
    return [...this.rows.values()].find((request) => request.snapshot.remotePeerId.value === peerId.value && request.snapshot.status.startsWith('pending')) ?? null;
  }
  async list(): Promise<ContactRequest[]> { return [...this.rows.values()]; }
}

class InMemoryContactRepository implements ContactRepository {
  private readonly rows = new Map<string, Contact>();
  async save(contact: Contact): Promise<void> { this.rows.set(contact.snapshot.peerId.value, contact); }
  async findByPeerId(peerId: PeerId): Promise<Contact | null> { return this.rows.get(peerId.value) ?? null; }
  async list(): Promise<Contact[]> { return [...this.rows.values()]; }
}

class FixedIds implements IdGenerator {
  private next = 0;
  newId(prefix = 'id'): string { this.next += 1; return `${prefix}_${this.next}`; }
}

const keys: IdentityKeyProvider = {
  async generateIdentity() {
    return {
      peerId: 'pc_abcdefghijklmnop',
      publicKey: 'pub_identity',
      privateKeyReference: 'keyref_local_secure_store',
      fingerprint: 'fp_0123456789abcdef0123456789abcdef',
      deviceId: 'device_1',
      devicePublicKey: 'pub_device'
    };
  }
};

describe('identity and contact use cases', () => {
  it('creates a local identity through ports', async () => {
    const repo = new InMemoryIdentityRepository();
    const useCase = new CreateLocalIdentityUseCase(keys, repo, new NoopDomainEventBus(), new FixedIds());
    const result = await useCase.execute({ deviceName: 'Workstation' });
    expect(result.ok).toBe(true);
    expect(await repo.getLocal()).not.toBeNull();
  });

  it('sends and approves inbound contact requests', async () => {
    const requests = new InMemoryContactRequestRepository();
    const contacts = new InMemoryContactRepository();
    const ids = new FixedIds();
    const events = new NoopDomainEventBus();
    const sent = await new SendContactRequestUseCase(requests, events, ids).execute({ localPeerId: 'pc_localpeer1234567', remotePeerId: 'pc_remotepeer123456' });
    expect(sent.ok).toBe(true);

    const inbound = await requests.findById(sent.ok ? sent.value.requestId : '');
    expect(inbound?.snapshot.status).toBe('pending_outbound');
  });

  it('approves received contact request and creates trusted contact', async () => {
    const requests = new InMemoryContactRequestRepository();
    const contacts = new InMemoryContactRepository();
    const ids = new FixedIds();
    const events = new NoopDomainEventBus();
    const { ReceiveContactRequestUseCase } = await import('../index.js');
    await new ReceiveContactRequestUseCase(requests, events, ids).execute({ requestId: 'crq_inbound', localPeerId: 'pc_localpeer1234567', remotePeerId: 'pc_remotepeer123456' });
    const result = await new ApproveContactRequestUseCase(requests, contacts, events, ids).execute({ requestId: 'crq_inbound' });
    expect(result.ok).toBe(true);
    expect((await contacts.list())[0]?.snapshot.status).toBe('accepted');
  });
});
