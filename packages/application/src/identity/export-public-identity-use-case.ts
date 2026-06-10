import { Result, err, ok } from '@peercomms/domain';
import { IdentityRepository } from '../ports/identity-ports.js';

export class ExportPublicIdentityUseCase {
  constructor(private readonly identities: IdentityRepository) {}
  async execute(): Promise<Result<ReturnType<NonNullable<Awaited<ReturnType<IdentityRepository['getLocal']>>>['publicProfile']>>> {
    const identity = await this.identities.getLocal();
    if (!identity) return err(new Error('Local identity not found'));
    return ok(identity.publicProfile());
  }
}
