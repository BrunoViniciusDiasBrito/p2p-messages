import { Group, GroupId, GroupInvitation } from '@peercomms/domain';

export interface GroupRepository {
  save(group: Group): Promise<void>;
  findById(groupId: GroupId): Promise<Group | null>;
  list(): Promise<Group[]>;
}

export interface GroupInvitationRepository {
  save(invitation: GroupInvitation): Promise<void>;
  findById(invitationId: string): Promise<GroupInvitation | null>;
  list(): Promise<GroupInvitation[]>;
}

export interface GroupCryptoPort {
  initializeGroup(input: { groupId: string; creatorPeerId: string }): Promise<{ epoch: number; welcomeSecretReference: string }>;
  createWelcome(input: { groupId: string; inviterPeerId: string; inviteePeerId: string; epoch: number }): Promise<{ welcomePayload: string }>;
  acceptWelcome(input: { groupId: string; inviteePeerId: string; welcomePayload: string }): Promise<{ epoch: number }>;
  rotateEpoch(input: { groupId: string; epoch: number; reason: 'member_added' | 'member_removed' | 'manual' }): Promise<{ epoch: number }>;
}
