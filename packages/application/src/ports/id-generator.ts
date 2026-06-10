export interface IdGenerator { newId(prefix?: string): string; }

export class CryptoRandomIdGenerator implements IdGenerator {
  newId(prefix = 'id'): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }
}
