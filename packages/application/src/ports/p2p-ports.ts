import { NetworkMode, PeerReachabilityStatus } from '@peercomms/domain';

export interface DiscoveredPeerDto {
  readonly peerId: string;
  readonly reachability: PeerReachabilityStatus;
}

export interface PeerNodeRuntimePort {
  start(input: { localPeerId: string; mode: Exclude<NetworkMode, 'offline'> }): Promise<void>;
  stop(): Promise<void>;
  discoverPeers(): Promise<DiscoveredPeerDto[]>;
  connectToPeer(peerId: string): Promise<void>;
  publishEnvelope(input: { toPeerId?: string; envelopeJson: string }): Promise<'published' | 'peer_unreachable'>;
  getStatus(): Promise<{ mode: NetworkMode; started: boolean }>;
}

export interface IncomingEnvelopeProcessorPort {
  handle(input: { envelopeJson: string; receivedAt: Date }): Promise<void>;
}
