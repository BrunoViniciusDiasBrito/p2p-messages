import { CompactInboxReplayMetadataUseCase } from '@peercomms/application';
import type { DaemonMaintenanceTask } from './daemon.js';

export interface InboxReplayCompactionTaskOptions {
  readonly intervalMs?: number;
  readonly retentionDays?: number;
  readonly batchSize?: number;
}

export class InboxReplayCompactionTask implements DaemonMaintenanceTask {
  readonly name = 'inbox-replay-compaction';
  readonly intervalMs: number;
  readonly runOnStart = true;
  private readonly retentionDays: number | undefined;
  private readonly batchSize: number | undefined;

  constructor(
    private readonly useCase: CompactInboxReplayMetadataUseCase,
    options: InboxReplayCompactionTaskOptions = {}
  ) {
    this.intervalMs = options.intervalMs ?? 24 * 60 * 60 * 1000;
    this.retentionDays = options.retentionDays;
    this.batchSize = options.batchSize;
  }

  async run(): Promise<void> {
    const result = await this.useCase.execute({
      ...(this.retentionDays === undefined ? {} : { retentionDays: this.retentionDays }),
      ...(this.batchSize === undefined ? {} : { limit: this.batchSize })
    });
    if (!result.ok) throw result.error;
  }
}
