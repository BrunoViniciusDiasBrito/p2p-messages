import { Result, err } from '@peercomms/domain';

export class ImportRecoveryBundleUseCase {
  async execute(): Promise<Result<never>> {
    return err(new Error('Recovery import requires encrypted key-store adapter; planned for hardening phase'));
  }
}
