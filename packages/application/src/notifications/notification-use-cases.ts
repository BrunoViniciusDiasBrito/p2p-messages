import { Notification, NotificationChannel, NotificationProps, NotificationType, Result, err, ok } from '@peercomms/domain';
import { DomainEventBus } from '../ports/event-bus.js';
import { IdGenerator } from '../ports/id-generator.js';
import { LocalNotificationPublisher, NotificationEventSubscriptionPort, NotificationRepository } from '../ports/notification-ports.js';

export class CreateNotificationUseCase {
  constructor(private readonly notifications: NotificationRepository, private readonly publisher: LocalNotificationPublisher, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}

  async execute(input: { type: NotificationType; title: string; body?: string; channels?: readonly NotificationChannel[] }): Promise<Result<{ notificationId: string }>> {
    const now = new Date();
    const notification = Notification.create({
      id: this.ids.newId('ntf'),
      type: input.type,
      title: input.title,
      ...(input.body ? { body: input.body } : {}),
      channels: input.channels ?? ['in_app', 'local_api_event', 'local_sse'],
      createdAt: now
    }, this.ids.newId('evt'));
    await this.notifications.save(notification);
    await this.publisher.publish(notification);
    await this.events.publish(notification.pullDomainEvents());
    return ok({ notificationId: notification.snapshot.id });
  }
}

export class MarkNotificationAsReadUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(input: { notificationId: string }): Promise<Result<void>> {
    const notification = await this.notifications.findById(input.notificationId);
    if (!notification) return err(new Error('Notification not found'));
    notification.markRead(new Date());
    await this.notifications.save(notification);
    return ok(undefined);
  }
}

export class ListNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(input: { limit?: number; unreadOnly?: boolean } = {}): Promise<Result<readonly NotificationProps[]>> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const notifications = input.unreadOnly
      ? await this.notifications.listUnread()
      : await this.notifications.listAll(limit);
    return ok(notifications.slice(0, limit).map((notification) => notification.snapshot));
  }
}

export class SubscribeToNotificationEventsUseCase {
  constructor(private readonly subscriptions: NotificationEventSubscriptionPort) {}

  async execute(input: { channels: readonly NotificationChannel[]; types?: readonly NotificationType[] }): Promise<Result<{ subscriptionId: string }>> {
    return ok(await this.subscriptions.subscribe(input));
  }
}
