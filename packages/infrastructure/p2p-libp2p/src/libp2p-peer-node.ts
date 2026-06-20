import { bootstrap } from '@libp2p/bootstrap';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { kadDHT } from '@libp2p/kad-dht';
import { mdns } from '@libp2p/mdns';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { multiaddr } from '@multiformats/multiaddr';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import type { IncomingEnvelopeProcessorPort, PeerNodeRuntimePort } from '@peercomms/application';
import type { NetworkMode, PeerReachabilityStatus } from '@peercomms/domain';
import { createLibp2p } from 'libp2p';

export const libp2pAdapterProtocol = '/peercomms/envelope/1.0.0';

interface KnownPeer {
  readonly multiaddrs: readonly string[];
  connected: boolean;
  lastSeenAt?: Date;
}

export interface Libp2pRuntimeEvent {
  readonly type: 'peer.discovered' | 'peer.connected' | 'peer.disconnected';
  readonly transportPeerId: string;
  readonly at: Date;
}

export interface Libp2pPeerNodeOptions {
  readonly listenMultiaddrs?: readonly string[];
  readonly bootstrapMultiaddrs?: readonly string[];
  readonly enableMdns?: boolean;
  readonly enableDht?: boolean;
  readonly enableRelay?: boolean;
  readonly enableWebSockets?: boolean;
  readonly maxEnvelopeBytes?: number;
  readonly onRuntimeEvent?: (event: Libp2pRuntimeEvent) => void;
}

/**
 * libp2p runtime with Noise encryption, Yamux streams, mDNS discovery and
 * opt-in DHT, bootstrap and relay transports. Application peer identifiers are
 * registered separately from libp2p multiaddrs to avoid conflating key formats.
 */
export class Libp2pPeerNodeRuntime implements PeerNodeRuntimePort {
  private node: any | null = null;
  private localPeerId: string | null = null;
  private mode: NetworkMode = 'offline';
  private readonly knownPeers = new Map<string, KnownPeer>();

  constructor(
    private readonly incoming: IncomingEnvelopeProcessorPort,
    private readonly options: Libp2pPeerNodeOptions = {}
  ) {}

  registerPeer(input: { peerId: string; multiaddrs: readonly string[] }): void {
    if (input.multiaddrs.length === 0) throw new Error('libp2p peers require at least one multiaddr');
    const existing = this.knownPeers.get(input.peerId);
    this.knownPeers.set(input.peerId, {
      multiaddrs: [...input.multiaddrs],
      connected: existing?.connected ?? false,
      ...(existing?.lastSeenAt ? { lastSeenAt: existing.lastSeenAt } : {})
    });
  }

  getLocalMultiaddrs(): string[] {
    this.assertStarted();
    return this.node!.getMultiaddrs().map((address: { toString(): string }) => address.toString());
  }

  async start(input: { localPeerId: string; mode: Exclude<NetworkMode, 'offline'> }): Promise<void> {
    if (this.node) return;
    this.localPeerId = input.localPeerId;
    this.mode = input.mode;
    const discovery: any[] = this.options.enableMdns === false ? [] : [mdns()];
    if (this.options.bootstrapMultiaddrs?.length) discovery.push(bootstrap({ list: [...this.options.bootstrapMultiaddrs] }));
    const transports: any[] = [tcp()];
    if (this.options.enableWebSockets) transports.push(webSockets());
    if (this.options.enableRelay) transports.push(circuitRelayTransport());
    const services = this.options.enableDht ? { dht: kadDHT() } : {};

    const node = await createLibp2p({
      addresses: { listen: [...(this.options.listenMultiaddrs ?? ['/ip4/127.0.0.1/tcp/0'])] },
      transports,
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: discovery,
      services
    } as any);
    node.handle(libp2pAdapterProtocol, async (stream: any) => {
      try {
        const envelopeJson = await this.readEnvelope(stream);
        await this.incoming.handle({ envelopeJson, receivedAt: new Date() });
      } finally {
        void stream.close();
      }
    });
    this.subscribeToRuntimeEvents(node);
    this.node = node;
  }

  async stop(): Promise<void> {
    const node = this.node;
    this.node = null;
    this.localPeerId = null;
    this.mode = 'offline';
    for (const peer of this.knownPeers.values()) peer.connected = false;
    if (node) await node.stop();
  }

  async discoverPeers(): Promise<Array<{ peerId: string; reachability: PeerReachabilityStatus }>> {
    this.assertStarted();
    return [...this.knownPeers.entries()].map(([peerId, peer]) => ({
      peerId,
      reachability: peer.connected ? 'peer_reachable' : 'queued_until_reachable'
    }));
  }

  async connectToPeer(peerId: string): Promise<void> {
    this.assertStarted();
    const peer = this.knownPeers.get(peerId);
    if (!peer) throw new Error(`No libp2p multiaddr is registered for peer ${peerId}`);
    await this.node!.dial(multiaddr(peer.multiaddrs[0]!));
    peer.connected = true;
    peer.lastSeenAt = new Date();
  }

  async publishEnvelope(input: { toPeerId?: string; envelopeJson: string }): Promise<'published' | 'peer_unreachable'> {
    this.assertStarted();
    if (input.toPeerId) return this.publishToPeer(input.toPeerId, input.envelopeJson);
    const results = await Promise.all([...this.knownPeers.keys()].map((peerId) => this.publishToPeer(peerId, input.envelopeJson)));
    return results.includes('published') ? 'published' : 'peer_unreachable';
  }

  async getStatus(): Promise<{ mode: NetworkMode; started: boolean }> {
    return { mode: this.mode, started: this.node !== null };
  }

  private async publishToPeer(peerId: string, envelopeJson: string): Promise<'published' | 'peer_unreachable'> {
    const peer = this.knownPeers.get(peerId);
    if (!peer) return 'peer_unreachable';
    try {
      const stream = await this.node!.dialProtocol(multiaddr(peer.multiaddrs[0]!), libp2pAdapterProtocol);
      await stream.send(new TextEncoder().encode(envelopeJson));
      await stream.close();
      peer.connected = true;
      peer.lastSeenAt = new Date();
      return 'published';
    } catch {
      peer.connected = false;
      return 'peer_unreachable';
    }
  }

  private async readEnvelope(stream: AsyncIterable<Uint8Array>): Promise<string> {
    const frame = await stream[Symbol.asyncIterator]().next();
    if (frame.done || !frame.value || frame.value.byteLength === 0) throw new Error('libp2p envelope stream is empty');
    if (frame.value.byteLength > (this.options.maxEnvelopeBytes ?? 256 * 1024)) throw new Error('libp2p envelope exceeds maximum size');
    return new TextDecoder().decode(frame.value);
  }

  private subscribeToRuntimeEvents(node: any): void {
    const eventType = (event: any): string => event.detail?.id?.toString() ?? event.detail?.remotePeer?.toString() ?? event.detail?.toString() ?? 'unknown';
    node.addEventListener('peer:discovery', (event: any) => this.options.onRuntimeEvent?.({ type: 'peer.discovered', transportPeerId: eventType(event), at: new Date() }));
    node.addEventListener('peer:connect', (event: any) => this.options.onRuntimeEvent?.({ type: 'peer.connected', transportPeerId: eventType(event), at: new Date() }));
    node.addEventListener('peer:disconnect', (event: any) => this.options.onRuntimeEvent?.({ type: 'peer.disconnected', transportPeerId: eventType(event), at: new Date() }));
  }

  private assertStarted(): void {
    if (!this.node || !this.localPeerId) throw new Error('libp2p peer node is not started');
  }
}
