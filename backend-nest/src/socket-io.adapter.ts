import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplication } from '@nestjs/common';

/**
 * Custom Socket.IO adapter with production-ready CORS and transport settings.
 * Fixes "xhr poll error" by allowing polling and websocket and proper CORS for Android.
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const corsOrigin = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : '*';

    const serverOptions: Partial<ServerOptions> = {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 20000,
      pingInterval: 25000,
      ...options,
    };

    return super.createIOServer(port, serverOptions);
  }
}
