/**
 * Storage abstraction: only keys are stored in DB.
 * Switch VPS → Bunny by swapping implementation; no DB migration.
 */
export interface StorageProvider {
  /** Upload file buffer; returns file_key (e.g. profile/user/123/photo1.jpg). */
  upload(
    buffer: Buffer,
    fileKey: string,
    mimeType?: string,
  ): Promise<string>;

  /** Delete by file_key. */
  delete(fileKey: string): Promise<void>;

  /** Public URL for a key (e.g. https://api.example.com/api/media/profile/user/123/photo1.jpg). */
  getPublicUrl(fileKey: string): string;

  /** Read file as Buffer (for GET /media/:key). Returns null if not found. */
  getStream(fileKey: string): Promise<Buffer | null>;
}
