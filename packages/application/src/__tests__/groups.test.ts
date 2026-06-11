import { describe, expect, it } from 'vitest';
import { Contact, Group, GroupId, GroupName, PeerId } from '@peercomms/domain';
import { CreateGroupUseCase, InvitePeerToGroupUseCase, NoopDomainEventBus, RemoveGroupMemberUseCase, type ContactRepository, type GroupCryptoPort, type IdGenerator } from '../index.js';
import type { GroupInvitationRepository, GroupRepository } from '../ports/group-ports.js';

class FixedIds implements IdGenerator {
  private next = 0;
  newId(prefix = 'id'): string { this.next += 1; return `${prefix}_${this.next}`; }
}

class Groups implements GroupRepository {
  private readonly rows = new Map<string, Group>();
  async save(group: Group): Promise<void> { this.rows.set(group.snapshot.id.value, group); }
  async findById(groupId: GroupId): Promise<Group | null> { return this.rows.get(groupId.value) ?? null; }
  async list(): Promise<Group[]> { return [...this.rows.values()]; }
}

class Invitations implements GroupInvitationRepository {
  private readonly rows = new Map<string, import('@peercomms/domain').GroupInvitation>();
  async save(invitation: import('@peercomms/domain').GroupInvitation): Promise<void> { this.rows.set(invitation.snapshot.id.value, invitation); }
  async findById(invitationId: string): Promise<import('@peercomms/domain').GroupInvitation | null> { return this.rows.get(invitationId) ?? null; }
  async list(): Promise<Array<import('@peercomms/domain').GroupInvitation>> { return [...this.rows.values()]; }
}

class Contacts implements ContactRepository {
  private readonly rows = new Map<string, Contact>();
  async save(contact: Contact): Promise<void> { this.rows.set(contact.snapshot.peerId.value, contact); }
  async findByPeerId(peerId: PeerId): Promise<Contact | null> { return this.rows.get(peerId.value) ?? null; }
  async list(): Promise<Contact[]> { return [...this.rows.values()]; }
}

const crypto: GroupCryptoPort = {
  async initializeGroup() { return { epoch: 0, welcomeSecretReference: 'keyref_group' }; },
  async createWelcome() { return { welcomePayload: 'welcome_payload_for_mls_adapter' }; },
  async acceptWelcome() { return { epoch: 0 }; },
  async rotateEpoch(input) { return { epoch: input.epoch }; }
};

describe('group use cases', () => {
  it('creates groups through ports', async () => {
    const groups = new Groups();
    const result = await new CreateGroupUseCase(groups, crypto, new NoopDomainEventBus(), new FixedIds()).execute({ ownerPeerId: 'pc_ownerpeer123456', name: 'Core Team' });
    expect(result.ok).toBe(true);
    expect((await groups.list())[0]?.snapshot.keyEpoch.value).toBe(0);
  });

  it('creates outbound invitations only for accepted contacts', async () => {
    const groups = new Groups();
    const contacts = new Contacts();
    const ids = new FixedIds();
    const group = Group.create({ id: GroupId.create('grp_existing'), name: GroupName.create('Core Team'), ownerPeerId: PeerId.create('pc_ownerpeer123456'), createdAt: new Date() }, 'evt_1');
    await groups.save(group);
    await contacts.save(Contact.accepted(PeerId.create('pc_inviteepeer1234'), new Date()));
    const result = await new InvitePeerToGroupUseCase(groups, new Invitations(), contacts, crypto, ids).execute({ groupId: 'grp_existing', inviterPeerId: 'pc_ownerpeer123456', inviteePeerId: 'pc_inviteepeer1234' });
    expect(result.ok).toBe(true);
  });

  it('rotates epoch when removing a member', async () => {
    const groups = new Groups();
    const group = Group.create({ id: GroupId.create('grp_existing'), name: GroupName.create('Core Team'), ownerPeerId: PeerId.create('pc_ownerpeer123456'), createdAt: new Date() }, 'evt_1');
    group.addMember(PeerId.create('pc_memberpeer12345'), new Date(), 'evt_2');
    await groups.save(group);
    const result = await new RemoveGroupMemberUseCase(groups, crypto, new NoopDomainEventBus(), new FixedIds()).execute({ groupId: 'grp_existing', peerId: 'pc_memberpeer12345' });
    expect(result.ok && result.value.epoch).toBe(1);
  });
});
