import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface LogEntry {
  level: string;
  message: string;
  context?: string;
  meta?: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class LoggingService {
  constructor(@InjectConnection() private mongo: Connection) {}

  private async writeToMongo(entry: LogEntry): Promise<void> {
    try {
      const col = this.mongo.collection('logs');
      await col.insertOne({ ...entry, timestamp: new Date() });
    } catch (e) {
      console.error('Log write failed:', (e as Error).message);
    }
  }

  log(message: string, context?: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'info', message, context, meta, timestamp: new Date() };
    this.writeToMongo(entry);
    console.log(context ? `[${context}] ${message}` : message, meta ?? '');
  }

  error(message: string, context?: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'error', message, context, meta, timestamp: new Date() };
    this.writeToMongo(entry);
    console.error(context ? `[${context}] ${message}` : message, meta ?? '');
  }

  warn(message: string, context?: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'warn', message, context, meta, timestamp: new Date() };
    this.writeToMongo(entry);
    console.warn(context ? `[${context}] ${message}` : message, meta ?? '');
  }
}
