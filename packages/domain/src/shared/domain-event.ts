export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  readonly id: string;
  readonly name: TName;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export abstract class AggregateRoot {
  private readonly events: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.events.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
