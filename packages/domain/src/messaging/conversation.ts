import { PeerId } from '../shared/ids.js';
import { ConversationId, LamportClock } from './value-objects.js';

export type ConversationType = 'direct' | 'group';

export interface ConversationProps {
  readonly id: ConversationId;
  readonly type: ConversationType;
  readonly peerId?: PeerId;
  readonly groupId?: string;
  readonly lamportClock: LamportClock;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Conversation {
  private props: ConversationProps;
  private constructor(props: ConversationProps) { this.props = props; }

  static direct(id: ConversationId, peerId: PeerId, now: Date): Conversation {
    return new Conversation({ id, type: 'direct', peerId, lamportClock: LamportClock.initial(), createdAt: now, updatedAt: now });
  }

  static rehydrate(props: ConversationProps): Conversation { return new Conversation(props); }

  tick(now: Date): LamportClock {
    const next = this.props.lamportClock.tick();
    this.props = { ...this.props, lamportClock: next, updatedAt: now };
    return next;
  }

  get snapshot(): ConversationProps { return this.props; }
}
