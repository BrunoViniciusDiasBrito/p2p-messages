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
    let url: URL;
    try {
      url = new URL(props.url);
    } catch {
      throw new DomainError('Local webhook URL must be valid', 'webhook.invalid_url');
    }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
      throw new DomainError('Local webhooks must target loopback URLs only', 'webhook.loopback_required');
    }
    if (props.eventTypes.length === 0) throw new DomainError('Webhook must subscribe to at least one event type', 'webhook.events_empty');
    return new WebhookSubscription(props);
  }

  static rehydrate(props: WebhookSubscriptionProps): WebhookSubscription { return new WebhookSubscription(props); }
  get snapshot(): WebhookSubscriptionProps { return this.props; }
}
