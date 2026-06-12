import { NetworkMode, PeerId, PeerNode, Result, err, ok } from '@peercomms/domain';
import { DomainEventBus } from '../ports/event-bus.js';
import { IdGenerator } from '../ports/id-generator.js';
import { IncomingEnvelopeProcessorPort, PeerNodeRuntimePort } from '../ports/p2p-ports.js';

export class StartPeerNodeUseCase {
  constructor(private readonly runtime: PeerNodeRuntimePort, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { localPeerId: string; mode?: Exclude<NetworkMode, 'offline'> }): Promise<Result<void>> {
    const node = PeerNode.create(PeerId.create(input.localPeerId), new Date());
    node.start(input.mode ?? 'local_lan', new Date());
    await this.runtime.start({ localPeerId: input.localPeerId, mode: input.mode ?? 'local_lan' });
    await this.events.publish(node.pullDomainEvents());
    this.ids.newId('noop');
    return ok(undefined);
  }
}

export class StopPeerNodeUseCase {
  constructor(private readonly runtime: PeerNodeRuntimePort) {}
  async execute(): Promise<Result<void>> {
    await this.runtime.stop();
    return ok(undefined);
  }
}

export class DiscoverPeersUseCase {
  constructor(private readonly runtime: PeerNodeRuntimePort, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { localPeerId: string }): Promise<Result<Array<{ peerId: string; reachability: string }>>> {
    const peers = await this.runtime.discoverPeers();
    const node = PeerNode.create(PeerId.create(input.localPeerId), new Date());
    for (const peer of peers) node.discover(PeerId.create(peer.peerId), new Date(), this.ids.newId('evt'));
    await this.events.publish(node.pullDomainEvents());
    return ok(peers);
  }
}

export class ConnectToPeerUseCase {
  constructor(private readonly runtime: PeerNodeRuntimePort, private readonly events: DomainEventBus, private readonly ids: IdGenerator) {}
  async execute(input: { localPeerId: string; peerId: string }): Promise<Result<void>> {
    await this.runtime.connectToPeer(input.peerId);
    const node = PeerNode.create(PeerId.create(input.localPeerId), new Date());
    node.start('local_lan', new Date());
    node.connect(PeerId.create(input.peerId), new Date(), this.ids.newId('evt'));
    await this.events.publish(node.pullDomainEvents());
    return ok(undefined);
  }
}

export class PublishEnvelopeUseCase {
  constructor(private readonly runtime: PeerNodeRuntimePort) {}
  async execute(input: { toPeerId?: string; envelopeJson: string }): Promise<Result<{ status: 'published' | 'peer_unreachable' }>> {
    if (!input.envelopeJson.trim()) return err(new Error('Envelope cannot be empty'));
    const status = await this.runtime.publishEnvelope(input);
    return ok({ status });
  }
}

export class HandleIncomingEnvelopeUseCase {
  constructor(private readonly processor: IncomingEnvelopeProcessorPort) {}
  async execute(input: { envelopeJson: string; receivedAt?: Date }): Promise<Result<void>> {
    if (!input.envelopeJson.trim()) return err(new Error('Envelope cannot be empty'));
    await this.processor.handle({ envelopeJson: input.envelopeJson, receivedAt: input.receivedAt ?? new Date() });
    return ok(undefined);
  }
}
