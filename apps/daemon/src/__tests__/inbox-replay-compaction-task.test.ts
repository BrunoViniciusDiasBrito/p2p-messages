import { describe, expect, it } from 'vitest';
import { ok } from '@peercomms/domain';
import { CompactInboxReplayMetadataUseCase } from '@peercomms/application';
import { InboxReplayCompactionTask } from '../inbox-replay-compaction-task.js';

describe('InboxReplayCompactionTask', () => {
  it('uses the configured retention policy when the daemon runs maintenance', async () => {
    let received: unknown;
    const useCase = {
      async execute(input: unknown) {
        received = input;
        return ok({ deleted: 2, cutoff: '2026-01-01T00:00:00.000Z' });
      }
    } as unknown as CompactInboxReplayMetadataUseCase;
    const task = new InboxReplayCompactionTask(useCase, { intervalMs: 60_000, retentionDays: 14, batchSize: 75 });

    await task.run();

    expect(task.name).toBe('inbox-replay-compaction');
    expect(task.runOnStart).toBe(true);
    expect(received).toEqual({ retentionDays: 14, limit: 75 });
  });
});
