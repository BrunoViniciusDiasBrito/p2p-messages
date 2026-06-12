import { LocalApiHttpHandler } from '@peercomms/integration-api';
import { SqliteMigrationRunner } from '@peercomms/storage-sqlite';

export interface LoopbackServerPort {
  listen(input: { host: '127.0.0.1'; port: number; handler: (request: Request) => Promise<Response> }): Promise<{ url: string }>;
  close(): Promise<void>;
}

export interface PeerCommsDaemonOptions {
  readonly port: number;
  readonly api: LocalApiHttpHandler;
  readonly migrations?: SqliteMigrationRunner;
  readonly server: LoopbackServerPort;
}

export class PeerCommsDaemon {
  private runningUrl: string | null = null;

  constructor(private readonly options: PeerCommsDaemonOptions) {}

  async start(): Promise<{ url: string }> {
    if (this.runningUrl) return { url: this.runningUrl };
    if (this.options.migrations) await this.options.migrations.run();
    const started = await this.options.server.listen({ host: '127.0.0.1', port: this.options.port, handler: (request) => this.options.api.handle(request) });
    this.runningUrl = started.url;
    return started;
  }

  async stop(): Promise<void> {
    if (!this.runningUrl) return;
    await this.options.server.close();
    this.runningUrl = null;
  }

  get url(): string | null { return this.runningUrl; }
}
