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
            if (!admin.apps.length) {
                if (process.env.FIREBASE_PROJECT_ID) {
                    this.firebaseApp = admin.initializeApp({
                        credential: admin.credential.cert({
                            projectId: process.env.FIREBASE_PROJECT_ID,
                            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                            // Replace literal \n with actual newlines
                            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                        }),
                    });
                    this.logger.log('Firebase Admin initialized successfully.');
                } else {
                    this.logger.warn('Firebase configuration missing. Push notifications will not be sent.');
                }
            } else {
                this.firebaseApp = admin.app();
            }
        } catch (error) {
            this.logger.error(`Error initializing Firebase Admin: ${error.message}`, error.stack);
        }
    }

    async sendPushNotification(token: string, title: string, body: string, data?: any) {
        if (!this.firebaseApp) {
            this.logger.warn('Firebase APP not initialized, skipping push notification');
            return;
        }

        try {
            const message = {
                notification: {
                    title,
                    body,
                },
                data: data || {},
                token: token,
            };

            const response = await this.firebaseApp.messaging().send(message);
            this.logger.log(`Successfully sent message: ${response}`);
            return response;
        } catch (error) {
            this.logger.error(`Error sending message: ${error.message}`, error.stack);
        }
    }
}
