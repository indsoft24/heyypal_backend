import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private conn: amqp.Channel | null = null;
  private uri: string;

  constructor(private config: ConfigService) {
    this.uri = this.config.get<string>('RABBITMQ_URI') || 'amqp://guest:guest@localhost:5672';
  }

  async onModuleInit() {
    try {
      const c = await amqp.connect(this.uri);
      this.conn = await c.createChannel();
    } catch (e) {
      console.warn('RabbitMQ not available:', (e as Error).message);
    }
  }

  async onModuleDestroy() {
    if (this.conn) await this.conn.close();
  }

  async publish(exchange: string, routingKey: string, payload: object): Promise<boolean> {
    if (!this.conn) return false;
    await this.conn.assertExchange(exchange, 'topic', { durable: true });
    return this.conn.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );
  }

  async assertQueue(name: string, options?: amqp.Options.AssertQueue): Promise<void> {
    if (this.conn) await this.conn.assertQueue(name, { durable: true, ...options });
  }
}
