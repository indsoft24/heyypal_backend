import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class JwtWsGuard extends AuthGuard('jwt') {
    private readonly logger = new Logger(JwtWsGuard.name);

    getRequest(context: ExecutionContext) {
        const client = context.switchToWs().getClient<Socket>();

        // Try extracting token from:
        // 1. Handshake headers (standard)
        // 2. Handshake auth (Socket.IO 3+)
        // 3. Handshake query (Socket.IO 2 backward compat)
        const authHeaders = client.handshake.headers.authorization;
        const authPayload = client.handshake.auth?.token;
        const queryToken = client.handshake.query?.token;

        const token = authHeaders ||
            (authPayload ? `Bearer ${authPayload}` : null) ||
            (queryToken ? `Bearer ${queryToken}` : null);

        return {
            headers: {
                authorization: token,
            },
        };
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (err || !user) {
            this.logger.error('WS Unauthorized access attempt');
            throw new WsException('Unauthorized');
        }

        // Attach the user to the socket client for later use
        const client = context.switchToWs().getClient<Socket>();
        (client as any).user = user;

        return user;
    }
}
