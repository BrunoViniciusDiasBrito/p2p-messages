import { AggregateRoot } from '../shared/domain-event.js';
import { DomainError } from '../shared/domain-error.js';

export type NotificationType =
  | 'message.received'
  | 'message.sent'
  | 'message.failed'
  | 'contact.request.received'
  | 'contact.request.approved'
  | 'group.invitation.received'
  | 'group.member.added'
  | 'peer.connected'
  | 'peer.disconnected'
  | 'integration.event';

export type NotificationChannel = 'desktop_local' | 'in_app' | 'local_api_event' | 'local_webhook' | 'local_sse';

export interface NotificationProps {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body?: string;
  readonly channels: readonly NotificationChannel[];
  readonly createdAt: Date;
  readonly readAt?: Date;
}

export class Notification extends AggregateRoot {
  private props: NotificationProps;
  private constructor(props: NotificationProps) { super(); this.props = props; }

  static create(props: Omit<NotificationProps, 'readAt'>, eventId: string): Notification {
    if (!props.id.trim()) throw new DomainError('Notification id cannot be empty', 'notification.id_empty');
    if (!props.title.trim()) throw new DomainError('Notification title cannot be empty', 'notification.title_empty');
    if (props.channels.length === 0) throw new DomainError('Notification must target at least one local channel', 'notification.channels_empty');
    const notification = new Notification(props);
    notification.record({ id: eventId, name: 'NotificationCreated', occurredAt: props.createdAt, payload: { notificationId: props.id, type: props.type, channels: props.channels } });
    return notification;
  }

  static rehydrate(props: NotificationProps): Notification { return new Notification(props); }

  markRead(readAt: Date): void {
    if (this.props.readAt) return;
    this.props = { ...this.props, readAt };
  }

  isRead(): boolean { return Boolean(this.props.readAt); }
  get snapshot(): NotificationProps { return this.props; }
}

export interface NotificationPreferenceProps {
  readonly enabledChannels: readonly NotificationChannel[];
  readonly mutedTypes: readonly NotificationType[];
}

export class NotificationPreference {
  private constructor(readonly props: NotificationPreferenceProps) {}
  static create(props: NotificationPreferenceProps): NotificationPreference {
    if (props.enabledChannels.length === 0) throw new DomainError('At least one notification channel must be enabled', 'notification_preference.channels_empty');
    return new NotificationPreference(props);
  }
  shouldNotify(type: NotificationType): boolean { return !this.props.mutedTypes.includes(type); }
}
