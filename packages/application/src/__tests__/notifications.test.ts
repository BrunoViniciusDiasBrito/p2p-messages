import { describe, expect, it } from 'vitest';
import { Notification } from '@peercomms/domain';
import { CreateNotificationUseCase, MarkNotificationAsReadUseCase, NoopDomainEventBus, SubscribeToNotificationEventsUseCase, type IdGenerator, type LocalNotificationPublisher, type NotificationEventSubscriptionPort, type NotificationRepository } from '../index.js';

class FixedIds implements IdGenerator {
  private next = 0;
  newId(prefix = 'id'): string { this.next += 1; return `${prefix}_${this.next}`; }
}

class Notifications implements NotificationRepository {
  readonly rows = new Map<string, Notification>();
  async save(notification: Notification): Promise<void> { this.rows.set(notification.snapshot.id, notification); }
  async findById(notificationId: string): Promise<Notification | null> { return this.rows.get(notificationId) ?? null; }
  async listUnread(): Promise<Notification[]> { return [...this.rows.values()].filter((notification) => !notification.isRead()); }
  async listAll(): Promise<Notification[]> { return [...this.rows.values()]; }
}

const publisher: LocalNotificationPublisher = { async publish() {} };
const subscriptions: NotificationEventSubscriptionPort = { async subscribe() { return { subscriptionId: 'sub_1' }; } };

describe('notification use cases', () => {
  it('creates and marks notifications as read', async () => {
    const notifications = new Notifications();
    const created = await new CreateNotificationUseCase(notifications, publisher, new NoopDomainEventBus(), new FixedIds()).execute({ type: 'message.received', title: 'New message' });
    expect(created.ok).toBe(true);
    const notificationId = created.ok ? created.value.notificationId : '';
    const read = await new MarkNotificationAsReadUseCase(notifications).execute({ notificationId });
    expect(read.ok).toBe(true);
    expect(await notifications.listUnread()).toHaveLength(0);
  });

  it('subscribes to local notification event channels', async () => {
    const result = await new SubscribeToNotificationEventsUseCase(subscriptions).execute({ channels: ['local_sse'], types: ['message.received'] });
    expect(result.ok && result.value.subscriptionId).toBe('sub_1');
  });
});
