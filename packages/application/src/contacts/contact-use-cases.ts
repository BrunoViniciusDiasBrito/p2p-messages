import { Contact, ContactRequest, ContactRequestId, PeerId, Result, err, ok } from '@peercomms/domain';
import { ContactRepository, ContactRequestRepository } from '../ports/contact-ports.js';
import { DomainEventBus } from '../ports/event-bus.js';
import { IdGenerator } from '../ports/id-generator.js';

export class SendContactRequestUseCase {
  constructor(private readonly requests: ContactRequestRepository, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { localPeerId: string; remotePeerId: string; message?: string }): Promise<Result<{ requestId: string }>> {
    const remotePeerId = PeerId.create(input.remotePeerId);
    const duplicate = await this.requests.findPendingWithPeer(remotePeerId);
    if (duplicate) return err(new Error('A pending contact request already exists for this peer'));
    const now = new Date();
    const props = { id: ContactRequestId.create(this.ids.newId('crq')), localPeerId: PeerId.create(input.localPeerId), remotePeerId, createdAt: now, updatedAt: now, ...(input.message ? { message: input.message } : {}) };
    const request = ContactRequest.outbound(props, this.ids.newId('evt'));
    await this.requests.save(request);
    await this.events.publish(request.pullDomainEvents());
    return ok({ requestId: request.snapshot.id.value });
  }
}

export class ReceiveContactRequestUseCase {
  constructor(private readonly requests: ContactRequestRepository, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { localPeerId: string; remotePeerId: string; requestId: string; message?: string }): Promise<Result<{ requestId: string }>> {
    const now = new Date();
    const props = { id: ContactRequestId.create(input.requestId), localPeerId: PeerId.create(input.localPeerId), remotePeerId: PeerId.create(input.remotePeerId), createdAt: now, updatedAt: now, ...(input.message ? { message: input.message } : {}) };
    const request = ContactRequest.inbound(props, this.ids.newId('evt'));
    await this.requests.save(request);
    await this.events.publish(request.pullDomainEvents());
    return ok({ requestId: input.requestId });
  }
}

export class ApproveContactRequestUseCase {
  constructor(private readonly requests: ContactRequestRepository, private readonly contacts: ContactRepository, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { requestId: string }): Promise<Result<{ peerId: string }>> {
    const request = await this.requests.findById(input.requestId);
    if (!request) return err(new Error('Contact request not found'));
    const now = new Date();
    request.approve(now, this.ids.newId('evt'));
    const contact = Contact.accepted(request.snapshot.remotePeerId, now);
    await this.requests.save(request);
    await this.contacts.save(contact);
    await this.events.publish(request.pullDomainEvents());
    return ok({ peerId: contact.snapshot.peerId.value });
  }
}

export class RejectContactRequestUseCase {
  constructor(private readonly requests: ContactRequestRepository) {}
  async execute(input: { requestId: string }): Promise<Result<void>> {
    const request = await this.requests.findById(input.requestId);
    if (!request) return err(new Error('Contact request not found'));
    request.reject(new Date());
    await this.requests.save(request);
    return ok(undefined);
  }
}

export class BlockPeerUseCase {
  constructor(private readonly contacts: ContactRepository, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { peerId: string }): Promise<Result<void>> {
    const peerId = PeerId.create(input.peerId);
    const contact = (await this.contacts.findByPeerId(peerId)) ?? Contact.accepted(peerId, new Date());
    contact.block(new Date(), this.ids.newId('evt'));
    await this.contacts.save(contact);
    await this.events.publish(contact.pullDomainEvents());
    return ok(undefined);
  }
}

export class ListContactsUseCase {
  constructor(private readonly contacts: ContactRepository) {}
  async execute(): Promise<Result<Array<{ peerId: string; status: string }>>> {
    const contacts = await this.contacts.list();
    return ok(contacts.map((contact) => ({ peerId: contact.snapshot.peerId.value, status: contact.snapshot.status })));
  }
}
