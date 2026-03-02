import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CallLog, CallStatus } from './entities/call-log.entity';

export interface CreateCallLogDto {
  callSessionId: string;
  callerId: number;
  receiverId: number;
  callStatus: CallStatus;
  startTime?: Date | null;
  endTime?: Date | null;
  durationSeconds?: number;
  callType?: string;
  missedFlag?: boolean;
}

@Injectable()
export class CallLogService {
  constructor(
    @InjectRepository(CallLog)
    private readonly repo: Repository<CallLog>,
  ) {}

  async create(dto: CreateCallLogDto): Promise<CallLog> {
    const log = this.repo.create(dto);
    return this.repo.save(log);
  }

  async updateEnd(
    callSessionId: string,
    endTime: Date,
    callStatus: CallStatus,
    durationSeconds: number,
    missedFlag?: boolean,
  ): Promise<void> {
    const update: Partial<CallLog> = { endTime, callStatus, durationSeconds };
    if (missedFlag !== undefined) update.missedFlag = missedFlag;
    await this.repo.update({ callSessionId }, update);
  }

  async findBySessionId(callSessionId: string): Promise<CallLog | null> {
    return this.repo.findOne({ where: { callSessionId } });
  }

  async findLogsByUser(
    userId: number,
    options?: { limit?: number; offset?: number; from?: Date; to?: Date },
  ): Promise<CallLog[]> {
    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.caller_id = :userId OR log.receiver_id = :userId', { userId })
      .orderBy('log.created_at', 'DESC');

    if (options?.from && options?.to) {
      qb.andWhere('log.created_at BETWEEN :from AND :to', {
        from: options.from,
        to: options.to,
      });
    }
    if (options?.limit) qb.take(options.limit);
    if (options?.offset) qb.skip(options.offset);

    return qb.getMany();
  }
}
