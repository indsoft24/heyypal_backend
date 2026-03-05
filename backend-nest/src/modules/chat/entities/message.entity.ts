import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'sender_id' })
    senderId: number;

    @Column({ name: 'receiver_id' })
    receiverId: number;

    @Column({ type: 'text' })
    content: string;

    @Column({ default: false, name: 'is_read' })
    isRead: boolean;

    @Column({ default: false, name: 'is_delivered' })
    isDelivered: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'sender_id' })
    sender: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'receiver_id' })
    receiver: User;
}
