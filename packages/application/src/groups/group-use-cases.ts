import { ContactRepository } from '../ports/contact-ports.js';
import { DomainEventBus } from '../ports/event-bus.js';
import { GroupCryptoPort, GroupInvitationRepository, GroupRepository } from '../ports/group-ports.js';
import { IdGenerator } from '../ports/id-generator.js';
import { Group, GroupId, GroupInvitation, GroupInvitationId, GroupName, PeerId, Result, err, ok } from '@peercomms/domain';

export class CreateGroupUseCase {
  constructor(private readonly groups: GroupRepository, private readonly crypto: GroupCryptoPort, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { ownerPeerId: string; name: string }): Promise<Result<{ groupId: string; epoch: number }>> {
    const now = new Date();
    const group = Group.create({ id: GroupId.create(this.ids.newId('grp')), name: GroupName.create(input.name), ownerPeerId: PeerId.create(input.ownerPeerId), createdAt: now }, this.ids.newId('evt'));
    await this.crypto.initializeGroup({ groupId: group.snapshot.id.value, creatorPeerId: input.ownerPeerId });
    await this.groups.save(group);
    await this.events.publish(group.pullDomainEvents());
    return ok({ groupId: group.snapshot.id.value, epoch: group.snapshot.keyEpoch.value });
  }
}

export class InvitePeerToGroupUseCase {
  constructor(private readonly groups: GroupRepository, private readonly invitations: GroupInvitationRepository, private readonly contacts: ContactRepository, private readonly crypto: GroupCryptoPort, private readonly ids: IdGenerator) {}
  async execute(input: { groupId: string; inviterPeerId: string; inviteePeerId: string }): Promise<Result<{ invitationId: string; welcomePayload: string }>> {
    const group = await this.groups.findById(GroupId.create(input.groupId));
    if (!group) return err(new Error('Group not found'));
    const inviterPeerId = PeerId.create(input.inviterPeerId);
    const inviteePeerId = PeerId.create(input.inviteePeerId);
    if (!group.hasActiveMember(inviterPeerId)) return err(new Error('Only active group members can invite peers'));
    const contact = await this.contacts.findByPeerId(inviteePeerId);
    if (!contact?.canReceiveDirectMessages()) return err(new Error('Group invites require an accepted, non-blocked contact'));
    const now = new Date();
    const invitation = GroupInvitation.outbound({ id: GroupInvitationId.create(this.ids.newId('ginv')), groupId: group.snapshot.id, inviterPeerId, inviteePeerId, createdAt: now, updatedAt: now });
    const welcome = await this.crypto.createWelcome({ groupId: input.groupId, inviterPeerId: input.inviterPeerId, inviteePeerId: input.inviteePeerId, epoch: group.snapshot.keyEpoch.value });
    await this.invitations.save(invitation);
    return ok({ invitationId: invitation.snapshot.id.value, welcomePayload: welcome.welcomePayload });
  }
}

export class AcceptGroupInvitationUseCase {
  constructor(private readonly groups: GroupRepository, private readonly invitations: GroupInvitationRepository, private readonly crypto: GroupCryptoPort, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { invitationId: string; welcomePayload: string }): Promise<Result<{ groupId: string; epoch: number }>> {
    const invitation = await this.invitations.findById(input.invitationId);
    if (!invitation) return err(new Error('Group invitation not found'));
    const now = new Date();
    invitation.accept(now, this.ids.newId('evt'));
    const accepted = await this.crypto.acceptWelcome({ groupId: invitation.snapshot.groupId.value, inviteePeerId: invitation.snapshot.inviteePeerId.value, welcomePayload: input.welcomePayload });
    let group = await this.groups.findById(invitation.snapshot.groupId);
    if (!group) {
      group = Group.create({ id: invitation.snapshot.groupId, name: GroupName.create(`Group ${invitation.snapshot.groupId.value}`), ownerPeerId: invitation.snapshot.inviterPeerId, createdAt: invitation.snapshot.createdAt }, this.ids.newId('evt'));
    }
    group.addMember(invitation.snapshot.inviteePeerId, now, this.ids.newId('evt'));
    await this.invitations.save(invitation);
    await this.groups.save(group);
    await this.events.publish([...invitation.pullDomainEvents(), ...group.pullDomainEvents()]);
    return ok({ groupId: invitation.snapshot.groupId.value, epoch: accepted.epoch });
  }
}

export class RejectGroupInvitationUseCase {
  constructor(private readonly invitations: GroupInvitationRepository) {}
  async execute(input: { invitationId: string }): Promise<Result<void>> {
    const invitation = await this.invitations.findById(input.invitationId);
    if (!invitation) return err(new Error('Group invitation not found'));
    invitation.reject(new Date());
    await this.invitations.save(invitation);
    return ok(undefined);
  }
}

export class RemoveGroupMemberUseCase {
  constructor(private readonly groups: GroupRepository, private readonly crypto: GroupCryptoPort, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { groupId: string; peerId: string }): Promise<Result<{ epoch: number }>> {
    const group = await this.groups.findById(GroupId.create(input.groupId));
    if (!group) return err(new Error('Group not found'));
    group.removeMember(PeerId.create(input.peerId), new Date(), this.ids.newId('evt'));
    const rotated = await this.crypto.rotateEpoch({ groupId: input.groupId, epoch: group.snapshot.keyEpoch.value, reason: 'member_removed' });
    await this.groups.save(group);
    await this.events.publish(group.pullDomainEvents());
    return ok({ epoch: rotated.epoch });
  }
}

export class RotateGroupKeysUseCase {
  constructor(private readonly groups: GroupRepository, private readonly crypto: GroupCryptoPort, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { groupId: string }): Promise<Result<{ epoch: number }>> {
    const group = await this.groups.findById(GroupId.create(input.groupId));
    if (!group) return err(new Error('Group not found'));
    group.rotateKeys(new Date(), this.ids.newId('evt'));
    const rotated = await this.crypto.rotateEpoch({ groupId: input.groupId, epoch: group.snapshot.keyEpoch.value, reason: 'manual' });
    await this.groups.save(group);
    await this.events.publish(group.pullDomainEvents());
    return ok({ epoch: rotated.epoch });
  }
}

export class SendGroupMessageUseCase {
  async execute(): Promise<Result<never>> {
    return err(new Error('Group message encryption requires MLS/OpenMLS adapter; planned after group membership foundation'));
  }
}
