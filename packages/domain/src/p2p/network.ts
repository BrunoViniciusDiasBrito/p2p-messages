import { AggregateRoot } from '../shared/domain-event.js';
import { DomainError } from '../shared/domain-error.js';
import { PeerId } from '../shared/ids.js';

export type NetworkMode = 'offline' | 'local_lan' | 'internet_p2p' | 'degraded' | 'relay_optional';
export type PeerReachabilityStatus = 'local_only' | 'peer_reachable' | 'peer_unreachable' | 'queued_until_reachable';

export interface PeerReachabilityProps {
  readonly peerId: PeerId;
  readonly status: PeerReachabilityStatus;
  readonly lastSeenAt?: Date;
}

export class PeerReachability {
  private constructor(readonly props: PeerReachabilityProps) {}
  static create(props: PeerReachabilityProps): PeerReachability { return new PeerReachability(props); }
}

export interface NetworkStatusProps {
  readonly mode: NetworkMode;
  readonly started: boolean;
  readonly updatedAt: Date;
}

export class NetworkStatus {
  private constructor(readonly props: NetworkStatusProps) {}
  static offline(now: Date): NetworkStatus { return new NetworkStatus({ mode: 'offline', started: false, updatedAt: now }); }
  static running(mode: Exclude<NetworkMode, 'offline'>, now: Date): NetworkStatus { return new NetworkStatus({ mode, started: true, updatedAt: now }); }
}

export interface PeerNodeProps {
  readonly localPeerId: PeerId;
  readonly status: NetworkStatus;
}

export class PeerNode extends AggregateRoot {
  private props: PeerNodeProps;
  private constructor(props: PeerNodeProps) { super(); this.props = props; }

  static create(localPeerId: PeerId, now: Date): PeerNode {
    return new PeerNode({ localPeerId, status: NetworkStatus.offline(now) });
  }

  start(mode: Exclude<NetworkMode, 'offline'>, now: Date): void {
    if (this.props.status.props.started) throw new DomainError('Peer node already started', 'peer_node.already_started');
    this.props = { ...this.props, status: NetworkStatus.running(mode, now) };
  }

  stop(now: Date): void {
    this.props = { ...this.props, status: NetworkStatus.offline(now) };
  }

  discover(peerId: PeerId, now: Date, eventId: string): void {
    this.record({ id: eventId, name: 'PeerDiscovered', occurredAt: now, payload: { peerId: peerId.value } });
  }

  connect(peerId: PeerId, now: Date, eventId: string): void {
    if (!this.props.status.props.started) throw new DomainError('Peer node must be started before connecting', 'peer_node.not_started');
    this.record({ id: eventId, name: 'PeerConnected', occurredAt: now, payload: { peerId: peerId.value } });
  }

  disconnect(peerId: PeerId, now: Date, eventId: string): void {
    this.record({ id: eventId, name: 'PeerDisconnected', occurredAt: now, payload: { peerId: peerId.value } });
  }

  get snapshot(): PeerNodeProps { return this.props; }
}
