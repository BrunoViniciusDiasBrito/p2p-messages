import { LocalApiHttpHandler } from '@peercomms/integration-api';
import { SqliteMigrationRunner } from '@peercomms/storage-sqlite';

export interface LoopbackServerPort {
  listen(input: { host: '127.0.0.1'; port: number; handler: (request: Request) => Promise<Response> }): Promise<{ url: string }>;
  close(): Promise<void>;
}

export interface DaemonResourcePort {
  close(): Promise<void>;
}

export interface DaemonMaintenanceTask {
  readonly name: string;
  readonly intervalMs: number;
  readonly runOnStart?: boolean;
  run(): Promise<void>;
}

export interface DaemonTimerPort {
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface PeerCommsDaemonOptions {
  readonly port: number;
  readonly api: LocalApiHttpHandler;
  readonly migrations?: SqliteMigrationRunner;
  readonly server: LoopbackServerPort;
  readonly resources?: readonly DaemonResourcePort[];
  readonly maintenanceTasks?: readonly DaemonMaintenanceTask[];
  readonly onMaintenanceError?: (input: { task: string; error: unknown }) => void;
  readonly timer?: DaemonTimerPort;
}

export class PeerCommsDaemon {
  private runningUrl: string | null = null;
  private readonly maintenanceTimers: unknown[] = [];
  private readonly runningMaintenance = new Set<string>();
  private readonly maintenanceRuns = new Set<Promise<void>>();
  private readonly timer: DaemonTimerPort;
  private resourcesClosed = false;

  constructor(private readonly options: PeerCommsDaemonOptions) {
    this.timer = options.timer ?? systemTimer;
  }

  async start(): Promise<{ url: string }> {
    if (this.runningUrl) return { url: this.runningUrl };
    if (this.resourcesClosed) throw new Error('A daemon with closed resources cannot be restarted; create a new daemon instance');
    try {
      validateMaintenanceTasks(this.options.maintenanceTasks ?? []);
      if (this.options.migrations) await this.options.migrations.run();
      const started = await this.options.server.listen({ host: '127.0.0.1', port: this.options.port, handler: (request) => this.options.api.handle(request) });
      this.runningUrl = started.url;
      this.startMaintenance();
      return started;
    } catch (error) {
      this.stopMaintenance();
      if (this.runningUrl) await closeSafely(() => this.options.server.close());
      this.runningUrl = null;
      await this.closeResources();
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stopMaintenance();
    await Promise.allSettled(this.maintenanceRuns);
    const serverError = this.runningUrl ? await closeSafely(() => this.options.server.close()) : undefined;
    this.runningUrl = null;
    const resourceError = await this.closeResources();
    if (serverError) throw serverError;
    if (resourceError) throw resourceError;
  }

  get url(): string | null { return this.runningUrl; }

  private startMaintenance(): void {
    for (const task of this.options.maintenanceTasks ?? []) {
      if (task.runOnStart !== false) this.runMaintenance(task);
      this.maintenanceTimers.push(this.timer.setInterval(() => this.runMaintenance(task), task.intervalMs));
    }
  }

  private runMaintenance(task: DaemonMaintenanceTask): void {
    if (this.runningMaintenance.has(task.name)) return;
    this.runningMaintenance.add(task.name);
    const run = Promise.resolve()
      .then(() => task.run())
      .catch((error: unknown) => {
        this.options.onMaintenanceError?.({ task: task.name, error });
      })
      .finally(() => {
        this.runningMaintenance.delete(task.name);
        this.maintenanceRuns.delete(run);
      });
    this.maintenanceRuns.add(run);
  }

  private stopMaintenance(): void {
    for (const timer of this.maintenanceTimers) this.timer.clearInterval(timer);
    this.maintenanceTimers.length = 0;
  }

  private async closeResources(): Promise<unknown | undefined> {
    const resources = this.options.resources ?? [];
    if (resources.length === 0) return undefined;
    if (this.resourcesClosed) return undefined;
    this.resourcesClosed = true;
    let firstError: unknown | undefined;
    for (const resource of resources) {
      const error = await closeSafely(() => resource.close());
      if (error && !firstError) firstError = error;
    }
    return firstError;
  }
}

const systemTimer: DaemonTimerPort = {
  setInterval: (callback, delayMs) => setInterval(callback, delayMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>)
};

function validateMaintenanceTasks(tasks: readonly DaemonMaintenanceTask[]): void {
  const names = new Set<string>();
  for (const task of tasks) {
    if (!task.name.trim()) throw new Error('Daemon maintenance task names cannot be empty');
    if (!Number.isSafeInteger(task.intervalMs) || task.intervalMs < 1) {
      throw new Error(`Daemon maintenance task "${task.name}" must have a positive integer interval`);
    }
    if (names.has(task.name)) throw new Error(`Duplicate daemon maintenance task "${task.name}"`);
    names.add(task.name);
  }
}

async function closeSafely(close: () => Promise<void>): Promise<unknown | undefined> {
  try {
    await close();
    return undefined;
  } catch (error) {
    return error;
  }
}
