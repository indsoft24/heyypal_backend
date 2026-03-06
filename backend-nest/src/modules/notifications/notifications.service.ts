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
            this.logger.log('Firebase Admin initialized successfully.');
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
     * Send high-priority FCM for incoming call. Use data payload so app can handle when
     * in background/killed (onMessageReceived). Optional notification shows "Incoming call" when app is closed.
     */
    async sendIncomingCallPush(
        token: string,
        data: { callSessionId: string; callerId: string; channelName: string; callerName?: string },
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
                callSessionId: data.callSessionId,
                callerId: data.callerId,
                channelName: data.channelName,
            };
            if (data.callerName) stringData.callerName = data.callerName;

            const message: admin.messaging.Message = {
                data: stringData,
                notification: {
                    title: 'Incoming call',
                    body: data.callerName ? `${data.callerName} is calling you` : 'You have an incoming call',
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'incoming_call',
                        priority: 'max',
                    },
                },
                token,
            };

            await this.firebaseApp.messaging().send(message);
            this.logger.log(`Incoming call push sent to token (callSessionId=${data.callSessionId})`);
        } catch (error) {
            this.logger.error(`Error sending incoming call push: ${error.message}`, error.stack);
        }
    }
}
