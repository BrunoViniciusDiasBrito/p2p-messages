import { DomainEvent } from '@peercomms/domain';

export interface DomainEventBus {
  publish(events: DomainEvent[]): Promise<void>;
}

export class NoopDomainEventBus implements DomainEventBus {
  async publish(): Promise<void> {}
}
