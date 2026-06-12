import { AggregateRoot } from '../shared/domain-event.js';
import { DomainError } from '../shared/domain-error.js';

export interface ExternalApplicationProps {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly revokedAt?: Date;
}

export class ExternalApplication extends AggregateRoot {
  private props: ExternalApplicationProps;
  private constructor(props: ExternalApplicationProps) { super(); this.props = props; }

  static register(props: ExternalApplicationProps, eventId: string): ExternalApplication {
    if (!props.name.trim()) throw new DomainError('External application name cannot be empty', 'external_application.name_empty');
    const app = new ExternalApplication(props);
    app.record({ id: eventId, name: 'ExternalAppRegistered', occurredAt: props.createdAt, payload: { appId: props.id, name: props.name } });
    return app;
  }

  static rehydrate(props: ExternalApplicationProps): ExternalApplication { return new ExternalApplication(props); }

  revoke(now: Date): void { this.props = { ...this.props, revokedAt: now }; }
  isActive(): boolean { return !this.props.revokedAt; }
  get snapshot(): ExternalApplicationProps { return this.props; }
}
