import { LocalApiHttpHandler } from '@peercomms/integration-api';
import { type NodeSqlitePersistenceOptions, openNodeSqlitePersistence } from '@peercomms/storage-sqlite';
import { PeerCommsDaemon, type DaemonMaintenanceTask, type DaemonTimerPort, type LoopbackServerPort } from './daemon.js';
import { NodeLoopbackServer } from './node-loopback-server.js';

export interface SqliteDaemonOptions {
  readonly port: number;
  readonly api: LocalApiHttpHandler;
  readonly database: NodeSqlitePersistenceOptions;
  readonly server?: LoopbackServerPort;
  readonly maintenanceTasks?: readonly DaemonMaintenanceTask[];
  readonly onMaintenanceError?: (input: { task: string; error: unknown }) => void;
  readonly timer?: DaemonTimerPort;
}

/** Creates a daemon whose migrations and lifecycle are backed by node:sqlite. */
export async function createSqliteDaemon(options: SqliteDaemonOptions): Promise<PeerCommsDaemon> {
  const persistence = await openNodeSqlitePersistence(options.database);
  return new PeerCommsDaemon({
    port: options.port,
    api: options.api,
    migrations: persistence.migrations,
    server: options.server ?? new NodeLoopbackServer(),
    resources: [persistence],
    ...(options.maintenanceTasks === undefined ? {} : { maintenanceTasks: options.maintenanceTasks }),
    ...(options.onMaintenanceError === undefined ? {} : { onMaintenanceError: options.onMaintenanceError }),
    ...(options.timer === undefined ? {} : { timer: options.timer })
  });
}
