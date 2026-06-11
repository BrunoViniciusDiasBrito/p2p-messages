import { Device, DeviceId, Identity, IdentityFingerprint, PeerId, PrivateKeyReference, PublicKey } from '@peercomms/domain';
import { IdentityRepository } from '@peercomms/application';
import { fromIso, SqliteDatabasePort, SqliteRow } from './database.js';

interface IdentityRow extends SqliteRow {
  peer_id: string;
  public_key: string;
  private_key_reference: string;
  fingerprint: string;
  created_at: string;
}

interface DeviceRow extends SqliteRow {
  id: string;
  name: string;
  public_key: string;
  created_at: string;
}

export class SqliteIdentityRepository implements IdentityRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(identity: Identity): Promise<void> {
    await this.db.execute(
      `INSERT INTO identities (peer_id, public_key, private_key_reference, fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(peer_id) DO UPDATE SET public_key = excluded.public_key, private_key_reference = excluded.private_key_reference, fingerprint = excluded.fingerprint`,
      [identity.props.peerId.value, identity.props.publicKey.value, identity.props.privateKeyReference.value, identity.props.fingerprint.value, identity.props.createdAt.toISOString()]
    );
    for (const device of identity.props.devices) {
      await this.db.execute(
        `INSERT INTO devices (id, peer_id, name, public_key, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, public_key = excluded.public_key`,
        [device.props.id.value, identity.props.peerId.value, device.props.name, device.props.publicKey.value, device.props.createdAt.toISOString()]
      );
    }
  }

  async getLocal(): Promise<Identity | null> {
    const row = await this.db.queryOne<IdentityRow>('SELECT peer_id, public_key, private_key_reference, fingerprint, created_at FROM identities ORDER BY created_at ASC LIMIT 1');
    if (!row) return null;
    const devices = await this.db.query<DeviceRow>('SELECT id, name, public_key, created_at FROM devices WHERE peer_id = ? ORDER BY created_at ASC', [row.peer_id]);
    return Identity.rehydrate({
      peerId: PeerId.create(row.peer_id),
      publicKey: PublicKey.create(row.public_key),
      privateKeyReference: PrivateKeyReference.create(row.private_key_reference),
      fingerprint: IdentityFingerprint.create(row.fingerprint),
      devices: devices.map((device) => new Device({ id: DeviceId.create(device.id), name: device.name, publicKey: PublicKey.create(device.public_key), createdAt: fromIso(device.created_at) })),
      createdAt: fromIso(row.created_at)
    });
  }
}
