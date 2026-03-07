import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private firebaseApp: admin.app.App;

    constructor() {
        this.initializeFirebase();
    }

    private initializeFirebase() {
        try {
            if (admin.apps.length > 0) {
                this.firebaseApp = admin.app();
                this.logger.log('Reusing existing Firebase Admin instance.');
                return;
            }

            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

            if (!projectId || !clientEmail || !privateKey) {
                this.logger.warn(
                    `Firebase configuration missing. ` +
                    `PROJECT_ID=${!!projectId}, CLIENT_EMAIL=${!!clientEmail}, PRIVATE_KEY=${!!privateKey}. ` +
                    `Push notifications will not be sent.`
                );
                return;
            }

            this.firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            this.logger.log(`Firebase Admin initialized successfully for PROJECT_ID=${projectId}`);
        } catch (error) {
            this.logger.error(`Error initializing Firebase Admin: ${error.message}`, error.stack);
        }
    }

    async sendPushNotification(token: string, title: string, body: string, data?: Record<string, any>) {
        if (!this.firebaseApp) {
            this.logger.warn('Firebase APP not initialized, skipping push notification');
            return;
        }

        if (!token) {
            this.logger.warn('No FCM token provided, skipping push notification');
            return;
        }

        try {
            // FCM data payload values must all be strings
            const stringData: Record<string, string> = {};
            if (data) {
                for (const [key, val] of Object.entries(data)) {
                    stringData[key] = String(val);
                }
            }

            const message: admin.messaging.Message = {
                notification: {
                    title,
                    body,
                },
                data: stringData,
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'chat_notifications',
                    },
                },
                token,
            };

            const response = await this.firebaseApp.messaging().send(message);
            this.logger.log(`Successfully sent push notification: ${response}`);
            return response;
        } catch (error) {
            this.logger.error(`Error sending push notification: ${error.message}`, error.stack);
        }
    }

    /**
     * Send high-priority data-only FCM for incoming call.
     * Works when app is foreground, background, or killed. Android shows full-screen intent.
     */
    async sendIncomingCallPush(
        token: string,
        data: {
            callSessionId: string;
            callerId: string;
            channelName: string;
            callerName?: string;
            agoraToken?: string;
            uid?: number;
        },
    ): Promise<void> {
        if (!this.firebaseApp) {
            this.logger.warn('Firebase APP not initialized, skipping incoming call push');
            return;
        }
        if (!token) {
            this.logger.warn('No FCM token for incoming call push');
            return;
        }
        try {
            const stringData: Record<string, string> = {
                type: 'incoming_call',
                callId: data.callSessionId,
                callSessionId: data.callSessionId,
                callerId: data.callerId,
                channelName: data.channelName,
            };
            if (data.callerName) stringData.callerName = data.callerName;
            if (data.agoraToken) stringData.agoraToken = data.agoraToken;
            if (data.uid != null) stringData.uid = String(data.uid);

            const message: admin.messaging.Message = {
                data: stringData,
                android: {
                    priority: 'high',
                    ttl: 30_000,
                    directBootOk: true,
                },
                token,
            };

            await this.firebaseApp.messaging().send(message);
            this.logger.log(`[incoming_call_push_sent] callSessionId=${data.callSessionId}`);
        } catch (error) {
            this.logger.error(`Error sending incoming call push: ${error.message}`, error.stack);
        }
    }

    /**
     * Send high-priority FCM to cancel/end an incoming call.
     * Stops ringing on receiver's device when app is killed.
     */
    async sendCallEndedPush(token: string, callSessionId: string): Promise<void> {
        if (!this.firebaseApp || !token) return;
        try {
            const message: admin.messaging.Message = {
                data: {
                    type: 'call_ended',
                    callSessionId,
                    callId: callSessionId,
                },
                android: {
                    priority: 'high',
                    directBootOk: true,
                },
                token,
            };
            await this.firebaseApp.messaging().send(message);
            this.logger.log(`[call_ended_push_sent] callSessionId=${callSessionId}`);
        } catch (error) {
            this.logger.error(`Error sending call ended push: ${error.message}`, error.stack);
        }
    }

    /** Alias: cancel call (stops ringing). Same as sendCallEndedPush. */
    async sendCallCancelledPush(token: string, callSessionId: string): Promise<void> {
        if (!this.firebaseApp || !token) return;
        try {
            const message: admin.messaging.Message = {
                data: {
                    type: 'call_cancelled',
                    callSessionId,
                    callId: callSessionId,
                },
                android: {
                    priority: 'high',
                    directBootOk: true,
                },
                token,
            };
            await this.firebaseApp.messaging().send(message);
            this.logger.log(`[call_cancelled_push_sent] callSessionId=${callSessionId}`);
        } catch (error) {
            this.logger.error(`Error sending call cancelled push: ${error.message}`, error.stack);
        }
    }
    /**
     * Send high-priority FCM to cancel/end an incoming call and show a missed call notification.
     */
    async sendMissedCallPush(
        token: string,
        data: { callSessionId: string, callerName?: string }
    ): Promise<void> {
        if (!this.firebaseApp || !token) return;
        try {
            const message: admin.messaging.Message = {
                data: {
                    type: 'missed_call',
                    callSessionId: data.callSessionId,
                    callerName: data.callerName || 'Someone',
                },
                android: {
                    priority: 'high',
                    directBootOk: true,
                },
                token,
            };
            await this.firebaseApp.messaging().send(message);
            this.logger.log(`[missed_call_push_sent] callSessionId=${data.callSessionId}`);
        } catch (error) {
            this.logger.error(`Error sending missed call push: ${error.message}`, error.stack);
        }
    }

    /**
     * Send data-only FCM for chat messages (type 'chat' for backward compat).
     */
    async sendChatPush(
        token: string,
        data: { senderId: string; senderName: string; content: string; messageId: string; conversationId?: string },
    ): Promise<void> {
        if (!this.firebaseApp || !token) return;
        try {
            const payload: Record<string, string> = {
                type: 'chat',
                senderId: data.senderId,
                senderName: data.senderName,
                content: data.content,
                messageId: data.messageId,
            };
            if (data.conversationId) payload.conversationId = data.conversationId;
            const message: admin.messaging.Message = {
                data: payload,
                android: { priority: 'high', ttl: 604_800_000 },
                token,
            };
            await this.firebaseApp.messaging().send(message);
            this.logger.log(`[chat_push_sent] from=${data.senderName} messageId=${data.messageId}`);
        } catch (error) {
            this.logger.error(`Error sending chat push: ${error.message}`, error.stack);
        }
    }

    /**
     * Send data-only FCM for chat (type 'chat_message'). Use for new clients.
     */
    async sendChatMessagePush(
        token: string,
        data: {
            conversationId: string;
            senderId: string;
            senderName: string;
            message: string;
            messageId?: string;
        },
    ): Promise<void> {
        if (!this.firebaseApp || !token) return;
        try {
            const payload: Record<string, string> = {
                type: 'chat_message',
                conversationId: data.conversationId,
                senderId: data.senderId,
                senderName: data.senderName,
                message: data.message,
                content: data.message,
            };
            if (data.messageId) payload.messageId = data.messageId;
            const message: admin.messaging.Message = {
                data: payload,
                android: { priority: 'high', ttl: 604_800_000 },
                token,
            };
            await this.firebaseApp.messaging().send(message);
            this.logger.log(`[chat_message_push_sent] from=${data.senderName}`);
        } catch (error) {
            this.logger.error(`Error sending chat message push: ${error.message}`, error.stack);
        }
    }
}
