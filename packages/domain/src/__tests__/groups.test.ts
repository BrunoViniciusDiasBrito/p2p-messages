import { describe, expect, it } from 'vitest';
import { Group, GroupId, GroupName, PeerId } from '../index.js';

describe('Group', () => {
  it('creates an owner member and emits GroupCreated', () => {
    const group = Group.create({ id: GroupId.create('grp_1'), name: GroupName.create('Core Team'), ownerPeerId: PeerId.create('pc_ownerpeer1234567'), createdAt: new Date() }, 'evt_1');
    expect(group.hasActiveMember(PeerId.create('pc_ownerpeer1234567'))).toBe(true);
    expect(group.pullDomainEvents()[0]?.name).toBe('GroupCreated');
  });

  it('rotates key epoch when a member is removed', () => {
    const now = new Date();
    const group = Group.create({ id: GroupId.create('grp_1'), name: GroupName.create('Core Team'), ownerPeerId: PeerId.create('pc_ownerpeer1234567'), createdAt: now }, 'evt_1');
    group.addMember(PeerId.create('pc_memberpeer123456'), now, 'evt_2');
    group.removeMember(PeerId.create('pc_memberpeer123456'), now, 'evt_3');
    expect(group.snapshot.keyEpoch.value).toBe(1);
  });
});
