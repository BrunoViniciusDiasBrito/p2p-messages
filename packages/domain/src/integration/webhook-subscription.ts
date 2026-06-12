import { DomainError } from '../shared/domain-error.js';

export type IntegrationEventType =
  | 'contact.request.received'
  | 'contact.request.approved'
  | 'message.received'
  | 'message.sent'
  | 'message.failed'
  | 'group.invitation.received'
  | 'group.member.added'
  | 'notification.created'
  | 'peer.connected'
  | 'peer.disconnected';

export interface WebhookSubscriptionProps {
  readonly id: string;
  readonly appId: string;
  readonly url: string;
  readonly eventTypes: readonly IntegrationEventType[];
  readonly createdAt: Date;
}

export class WebhookSubscription {
  private props: WebhookSubscriptionProps;
  private constructor(props: WebhookSubscriptionProps) { this.props = props; }

  static create(props: WebhookSubscriptionProps): WebhookSubscription {
    if (!props.url.startsWith('http://127.0.0.1') && !props.url.startsWith('http://localhost')) {
      throw new DomainError('Local webhooks must target loopback URLs only', 'webhook.loopback_required');
    }
    if (props.eventTypes.length === 0) throw new DomainError('Webhook must subscribe to at least one event type', 'webhook.events_empty');
    return new WebhookSubscription(props);
  }

  static rehydrate(props: WebhookSubscriptionProps): WebhookSubscription { return new WebhookSubscription(props); }
  get snapshot(): WebhookSubscriptionProps { return this.props; }
}
