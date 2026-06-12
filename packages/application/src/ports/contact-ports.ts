import { Contact, ContactRequest, PeerId } from '@peercomms/domain';

export interface ContactRequestRepository {
  save(request: ContactRequest): Promise<void>;
  findById(id: string): Promise<ContactRequest | null>;
  findPendingWithPeer(peerId: PeerId): Promise<ContactRequest | null>;
  list(): Promise<ContactRequest[]>;
}

export interface ContactRepository {
  save(contact: Contact): Promise<void>;
  findByPeerId(peerId: PeerId): Promise<Contact | null>;
  list(): Promise<Contact[]>;
}
