import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class JwtWsGuard extends AuthGuard('jwt') {
    private readonly logger = new Logger(JwtWsGuard.name);

    getRequest(context: ExecutionContext) {
        // Return the handhshake request so passport can extract the token
        const client = context.switchToWs().getClient<Socket>();

        // Some implementations send the token in auth object
        const authHeaders = client.handshake.headers.authorization;
        const authPayload = client.handshake.auth?.token;

        // Create a mock HTTP Request object that passport-jwt can use
        return {
            headers: {
                authorization: authHeaders || `Bearer ${authPayload}`,
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
