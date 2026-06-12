import { Notification, NotificationChannel, NotificationType } from '@peercomms/domain';
import { NotificationRepository } from '@peercomms/application';
import { fromIso, SqliteDatabasePort, SqliteRow, toIso } from './database.js';

interface NotificationRow extends SqliteRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  channels: string | null;
  read_at: string | null;
  created_at: string;
}

const parseChannels = (value: string | null): NotificationChannel[] => value ? JSON.parse(value) as NotificationChannel[] : ['in_app'];

const mapNotification = (row: NotificationRow): Notification => Notification.rehydrate({
  id: row.id,
  type: row.type,
  title: row.title,
  ...(row.body ? { body: row.body } : {}),
  channels: parseChannels(row.channels),
  createdAt: fromIso(row.created_at),
  ...(row.read_at ? { readAt: fromIso(row.read_at) } : {})
});

export class SqliteNotificationRepository implements NotificationRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(notification: Notification): Promise<void> {
    const snapshot = notification.snapshot;
    await this.db.execute(
      `INSERT INTO notifications (id, type, title, body, channels, read_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, channels = excluded.channels, read_at = excluded.read_at`,
      [snapshot.id, snapshot.type, snapshot.title, snapshot.body ?? null, JSON.stringify(snapshot.channels), toIso(snapshot.readAt), snapshot.createdAt.toISOString()]
    );
  }

  async findById(notificationId: string): Promise<Notification | null> {
    const row = await this.db.queryOne<NotificationRow>('SELECT id, type, title, body, channels, read_at, created_at FROM notifications WHERE id = ?', [notificationId]);
    return row ? mapNotification(row) : null;
  }

  async listUnread(): Promise<Notification[]> {
    const rows = await this.db.query<NotificationRow>('SELECT id, type, title, body, channels, read_at, created_at FROM notifications WHERE read_at IS NULL ORDER BY created_at DESC');
    return rows.map(mapNotification);
  }

  async listAll(limit: number): Promise<Notification[]> {
    const rows = await this.db.query<NotificationRow>('SELECT id, type, title, body, channels, read_at, created_at FROM notifications ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(mapNotification);
  }
}
