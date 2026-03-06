import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  private readonly logger = new Logger(CallLogService.name);

  constructor(
    @InjectRepository(CallLog)
    private readonly repo: Repository<CallLog>,
  ) { }

  /**
   * Create call log row. Use upsertInitiated for new calls to avoid duplicate key
   * errors if initiate is somehow called twice for the same session.
   */
  async create(dto: CreateCallLogDto): Promise<CallLog> {
    const log = this.repo.create(dto);
    return this.repo.save(log);
  }

  /**
   * Insert the initial call log row, or skip if one already exists for this session.
   * This makes the initiate flow idempotent at the postgres layer.
   */
  async upsertInitiated(dto: CreateCallLogDto): Promise<void> {
    try {
      const existing = await this.repo.findOne({ where: { callSessionId: dto.callSessionId } });
      if (!existing) {
        const log = this.repo.create(dto);
        await this.repo.save(log);
        this.logger.log(`[call_log_created] callSessionId=${dto.callSessionId}`);
      } else {
        this.logger.log(`[call_log_exists] callSessionId=${dto.callSessionId} skipping insert`);
      }
    } catch (err) {
      // Log and swallow — the call log is a best-effort audit trail;
      // it must not prevent the Agora token from being returned to the client.
      this.logger.error(`[call_log_upsert_error] callSessionId=${dto.callSessionId} ${(err as Error).message}`);
    }
  }

  async updateToConnected(callSessionId: string, startTime: Date): Promise<void> {
    await this.repo.update(
      { callSessionId },
      { callStatus: CallStatus.CONNECTED, startTime },
    );
    this.logger.log(`[call_log_connected] callSessionId=${callSessionId}`);
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
    this.logger.log(`[call_log_ended] callSessionId=${callSessionId} status=${callStatus} duration=${durationSeconds}s`);
  }

  async findBySessionId(callSessionId: string): Promise<CallLog | null> {
    return this.repo.findOne({ where: { callSessionId } });
  }

  async findLogsByUser(
    userId: number,
    options?: { limit?: number; offset?: number; from?: Date; to?: Date },
  ): Promise<CallLog[]> {
    return this.repo.find({
      where: [
        { callerId: userId },
        { receiverId: userId }
      ],
      relations: ['caller', 'receiver'],
      order: { createdAt: 'DESC' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0
    });
  }

  /** Admin analytics: all logs with optional filters. */
  async findLogsForAdmin(options: {
    limit?: number;
    offset?: number;
    from?: Date;
    to?: Date;
    callerId?: number;
    receiverId?: number;
  }): Promise<CallLog[]> {
    const where: any = {};
    if (options.callerId != null) where.callerId = options.callerId;
    if (options.receiverId != null) where.receiverId = options.receiverId;

    return this.repo.find({
      where,
      relations: ['caller', 'receiver'],
      order: { createdAt: 'DESC' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0
    });
  }
}
