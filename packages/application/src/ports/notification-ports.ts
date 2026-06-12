import { Notification, NotificationChannel, NotificationType } from '@peercomms/domain';

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(notificationId: string): Promise<Notification | null>;
  listUnread(): Promise<Notification[]>;
  listAll(limit: number): Promise<Notification[]>;
}

export interface LocalNotificationPublisher {
  publish(notification: Notification): Promise<void>;
}

export interface NotificationEventSubscriptionPort {
  subscribe(input: { channels: readonly NotificationChannel[]; types?: readonly NotificationType[] }): Promise<{ subscriptionId: string }>;
}
