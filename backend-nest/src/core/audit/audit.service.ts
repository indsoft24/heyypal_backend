import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface AuditEntry {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  role?: string;
  ip?: string;
  meta?: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class AuditService {
  constructor(@InjectConnection() private mongo: Connection) {}

  async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    try {
      const col = this.mongo.collection('audit_logs');
      await col.insertOne({ ...entry, timestamp: new Date() });
    } catch (e) {
      console.error('Audit write failed:', (e as Error).message);
    }
  }
}
