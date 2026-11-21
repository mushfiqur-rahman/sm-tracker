import type { PlatformId } from "../platforms";

export interface PublishMedia {
  url: string; // public URL (for networks that pull media)
  storageKey: string; // for networks that need the bytes uploaded
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

export interface PublishAccount {
  id: string;
  platform: PlatformId;
  externalId: string;
  accessToken: string; // decrypted
  meta: Record<string, string>;
}

export interface PublishInput {
  account: PublishAccount;
  text: string;
  media: PublishMedia[];
  options: Record<string, string>;
}

export interface PublishResult {
  externalId: string;
  url?: string;
}

export type Publisher = (input: PublishInput) => Promise<PublishResult>;

export class PublishError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
    public readonly needsReconnect = false,
  ) {
    super(message);
  }
}
