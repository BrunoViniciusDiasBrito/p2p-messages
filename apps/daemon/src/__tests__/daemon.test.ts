import { describe, expect, it } from 'vitest';
import { LocalApiHttpHandler, type LocalApiUseCases } from '@peercomms/integration-api';
import { ok } from '@peercomms/domain';
import { PeerCommsDaemon, type DaemonMaintenanceTask, type DaemonResourcePort, type DaemonTimerPort, type LoopbackServerPort } from '../daemon.js';

const useCases: LocalApiUseCases = {
  registerExternalApplication: { async execute() { return ok({ appId: 'app_1' }); } },
  createApiToken: { async execute() { return ok({ tokenId: 'tok_1', token: 'secret', scopes: [] }); } },
  exportPublicIdentity: { async execute() { return ok({ peerId: 'pc_peerpeerpeer1234' }); } },
  listContacts: { async execute() { return ok([]); } },
  sendContactRequest: { async execute() { return ok({ requestId: 'crq_1' }); } },
  approveContactRequest: { async execute() { return ok({}); } },
  rejectContactRequest: { async execute() { return ok({}); } },
  blockPeer: { async execute() { return ok({}); } },
  listConversations: { async execute() { return ok([]); } },
  listMessages: { async execute() { return ok([]); } },
  sendMessageFromExternalApp: { async execute() { return ok({ messageId: 'msg_1', envelopeId: 'env_1' }); } },
  subscribeExternalAppToEvents: { async execute() { return ok({ subscriptionId: 'sub_1' }); } }
};

class FakeServer implements LoopbackServerPort {
  started = false;
  async listen(input: { host: '127.0.0.1'; port: number }): Promise<{ url: string }> {
    this.started = true;
    return { url: `http://${input.host}:${input.port}` };
  }
  async close(): Promise<void> { this.started = false; }
}

class FakeTimer implements DaemonTimerPort {
  private nextId = 0;
  readonly callbacks = new Map<number, () => void>();

  setInterval(callback: () => void): number {
    this.nextId += 1;
    this.callbacks.set(this.nextId, callback);
    return this.nextId;
  }

  clearInterval(handle: unknown): void {
    this.callbacks.delete(Number(handle));
  }

  tick(): void {
    for (const callback of this.callbacks.values()) callback();
  }
}

const flushTasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('PeerCommsDaemon', () => {
  it('starts and stops the loopback server port', async () => {
    const server = new FakeServer();
    const daemon = new PeerCommsDaemon({ port: 17345, api: new LocalApiHttpHandler(useCases), server });
    await expect(daemon.start()).resolves.toEqual({ url: 'http://127.0.0.1:17345' });
    expect(server.started).toBe(true);
    await daemon.stop();
    expect(server.started).toBe(false);
  });

  it('runs scheduled maintenance without overlapping and closes daemon resources', async () => {
    const server = new FakeServer();
    const timer = new FakeTimer();
    let taskRuns = 0;
    let resourceCloseCalls = 0;
    const task: DaemonMaintenanceTask = {
      name: 'retention',
      intervalMs: 1,
      async run() { taskRuns += 1; }
    };
    const resource: DaemonResourcePort = { async close() { resourceCloseCalls += 1; } };
    const daemon = new PeerCommsDaemon({
      port: 17345,
      api: new LocalApiHttpHandler(useCases),
      server,
      timer,
      maintenanceTasks: [task],
      resources: [resource]
    });

    await daemon.start();
    await flushTasks();
    expect(taskRuns).toBe(1);
    timer.tick();
    await flushTasks();
    expect(taskRuns).toBe(2);

    await daemon.stop();
    expect(timer.callbacks.size).toBe(0);
    expect(resourceCloseCalls).toBe(1);
  });

  it('reports maintenance failures without bringing down the loopback server', async () => {
    const server = new FakeServer();
    const timer = new FakeTimer();
    const failures: string[] = [];
    const daemon = new PeerCommsDaemon({
      port: 17345,
      api: new LocalApiHttpHandler(useCases),
      server,
      timer,
      maintenanceTasks: [{ name: 'broken-task', intervalMs: 1, async run() { throw new Error('expected'); } }],
      onMaintenanceError: ({ task }) => failures.push(task)
    });

    await daemon.start();
    await flushTasks();

    expect(server.started).toBe(true);
    expect(failures).toEqual(['broken-task']);
    await daemon.stop();
  });

  it('releases the server and resources when scheduling cannot start', async () => {
    const server = new FakeServer();
    let resourceCloseCalls = 0;
    const timer: DaemonTimerPort = {
      setInterval() { throw new Error('timer unavailable'); },
      clearInterval() {}
    };
    const daemon = new PeerCommsDaemon({
      port: 17345,
      api: new LocalApiHttpHandler(useCases),
      server,
      timer,
      maintenanceTasks: [{ name: 'retention', intervalMs: 1, async run() {} }],
      resources: [{ async close() { resourceCloseCalls += 1; } }]
    });

    await expect(daemon.start()).rejects.toThrow('timer unavailable');

    expect(server.started).toBe(false);
    expect(resourceCloseCalls).toBe(1);
  });
});
