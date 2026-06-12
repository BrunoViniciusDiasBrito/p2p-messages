import { Group, GroupId, GroupInvitation, GroupInvitationId, GroupKeyEpoch, GroupMember, GroupName, PeerId } from '@peercomms/domain';
import { GroupInvitationRepository, GroupRepository } from '@peercomms/application';
import { fromIso, SqliteDatabasePort, SqliteRow, toIso } from './database.js';

interface GroupRow extends SqliteRow {
  id: string;
  name: string;
  key_epoch: number;
  created_at: string;
  updated_at: string;
}

interface GroupMemberRow extends SqliteRow {
  group_id: string;
  peer_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'removed';
  joined_at: string;
  removed_at: string | null;
}

interface GroupInvitationRow extends SqliteRow {
  id: string;
  group_id: string;
  inviter_peer_id: string;
  invitee_peer_id: string;
  status: 'pending_outbound' | 'pending_inbound' | 'accepted' | 'rejected' | 'revoked';
  created_at: string;
  updated_at: string;
}

const mapMember = (row: GroupMemberRow): GroupMember => GroupMember.rehydrate({
  peerId: PeerId.create(row.peer_id),
  role: row.role,
  status: row.status,
  joinedAt: fromIso(row.joined_at),
  ...(row.removed_at ? { removedAt: fromIso(row.removed_at) } : {})
});

const mapInvitation = (row: GroupInvitationRow): GroupInvitation => GroupInvitation.rehydrate({
  id: GroupInvitationId.create(row.id),
  groupId: GroupId.create(row.group_id),
  inviterPeerId: PeerId.create(row.inviter_peer_id),
  inviteePeerId: PeerId.create(row.invitee_peer_id),
  status: row.status,
  createdAt: fromIso(row.created_at),
  updatedAt: fromIso(row.updated_at)
});

export class SqliteGroupRepository implements GroupRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(group: Group): Promise<void> {
    const snapshot = group.snapshot;
    await this.db.execute(
      `INSERT INTO groups (id, name, key_epoch, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, key_epoch = excluded.key_epoch, updated_at = excluded.updated_at`,
      [snapshot.id.value, snapshot.name.value, snapshot.keyEpoch.value, snapshot.createdAt.toISOString(), snapshot.updatedAt.toISOString()]
    );
    for (const member of snapshot.members) {
      const memberSnapshot = member.snapshot;
      await this.db.execute(
        `INSERT INTO group_members (group_id, peer_id, role, status, joined_at, removed_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(group_id, peer_id) DO UPDATE SET role = excluded.role, status = excluded.status, removed_at = excluded.removed_at`,
        [snapshot.id.value, memberSnapshot.peerId.value, memberSnapshot.role, memberSnapshot.status, memberSnapshot.joinedAt.toISOString(), toIso(memberSnapshot.removedAt)]
      );
    }
  }

  async findById(groupId: GroupId): Promise<Group | null> {
    const row = await this.db.queryOne<GroupRow>('SELECT id, name, key_epoch, created_at, updated_at FROM groups WHERE id = ?', [groupId.value]);
    if (!row) return null;
    const members = await this.db.query<GroupMemberRow>('SELECT group_id, peer_id, role, status, joined_at, removed_at FROM group_members WHERE group_id = ? ORDER BY joined_at ASC', [groupId.value]);
    return Group.rehydrate({
      id: GroupId.create(row.id),
      name: GroupName.create(row.name),
      keyEpoch: GroupKeyEpoch.create(Number(row.key_epoch)),
      members: members.map(mapMember),
      createdAt: fromIso(row.created_at),
      updatedAt: fromIso(row.updated_at)
    });
  }

  async list(): Promise<Group[]> {
    const rows = await this.db.query<GroupRow>('SELECT id, name, key_epoch, created_at, updated_at FROM groups ORDER BY updated_at DESC');
    const groups: Group[] = [];
    for (const row of rows) {
      const group = await this.findById(GroupId.create(row.id));
      if (group) groups.push(group);
    }
    return groups;
  }
}

export class SqliteGroupInvitationRepository implements GroupInvitationRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(invitation: GroupInvitation): Promise<void> {
    const snapshot = invitation.snapshot;
    await this.db.execute(
      `INSERT INTO group_invitations (id, group_id, inviter_peer_id, invitee_peer_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
      [snapshot.id.value, snapshot.groupId.value, snapshot.inviterPeerId.value, snapshot.inviteePeerId.value, snapshot.status, snapshot.createdAt.toISOString(), snapshot.updatedAt.toISOString()]
    );
  }

  async findById(invitationId: string): Promise<GroupInvitation | null> {
    const row = await this.db.queryOne<GroupInvitationRow>('SELECT id, group_id, inviter_peer_id, invitee_peer_id, status, created_at, updated_at FROM group_invitations WHERE id = ?', [invitationId]);
    return row ? mapInvitation(row) : null;
  }

  async list(): Promise<GroupInvitation[]> {
    const rows = await this.db.query<GroupInvitationRow>('SELECT id, group_id, inviter_peer_id, invitee_peer_id, status, created_at, updated_at FROM group_invitations ORDER BY created_at DESC');
    return rows.map(mapInvitation);
  }
}
