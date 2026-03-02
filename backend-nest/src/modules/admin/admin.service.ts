import { Injectable, UnauthorizedException, ConflictException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from './entities/admin-user.entity';
import { User, UserRole, ExpertStatus } from '../users/entities/user.entity';
import { ExpertProfile } from '../experts/entities/expert-profile.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminUser) private adminRepo: Repository<AdminUser>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ExpertProfile) private expertRepo: Repository<ExpertProfile>,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const count = await this.adminRepo.count({ where: { role: AdminRole.ADMIN } });
    if (count === 0) {
      const email = this.config.get<string>('ADMIN_SEED_EMAIL') ?? 'admin@heyypal.com';
      const password = this.config.get<string>('ADMIN_SEED_PASSWORD') ?? 'Admin123!';
      const name = this.config.get<string>('ADMIN_SEED_NAME') ?? 'Admin';
      const hash = await bcrypt.hash(password, 12);
      await this.adminRepo.save(
        this.adminRepo.create({ name, email, passwordHash: hash, role: AdminRole.ADMIN }),
      );
      console.log('[Admin] Default admin created:', email);
    }
  }

  async login(email: string, password: string) {
    const admin = await this.adminRepo.findOne({ where: { email: email.trim() } });
    if (!admin) throw new UnauthorizedException('Invalid email or password');
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    const token = this.jwt.sign(
      {
        sub: String(admin.id),
        type: 'admin',
        role: admin.role,
        email: admin.email,
      },
      {
        secret: this.config.get<string>('JWT_SECRET') || 'change-me',
        expiresIn: this.config.get<string>('JWT_ADMIN_ACCESS_EXPIRY') || '1h',
      },
    );
    return {
      accessToken: token,
      user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    };
  }

  async listExperts() {
    const experts = await this.expertRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return {
      experts: experts.map((ex) => ({
        id: ex.user.id,
        google_id: ex.user.googleId,
        name: ex.user.name,
        email: ex.user.email,
        phone: null,
        role: ex.user.role,
        expert_status: ex.user.expertStatus,
        expert_type: ex.user.expertType,
        gender: ex.user.gender,
        date_of_birth: ex.user.dateOfBirth,
        created_at: ex.user.createdAt,
        profile: {
          id: ex.id,
          type: ex.type,
          category: ex.category,
          bio: ex.bio,
          languages_spoken: ex.languagesSpoken,
          photos: ex.photos,
          intro_video_url: ex.introVideoUrl,
          intro_video_compressed_url: ex.introVideoCompressedUrl,
          degree_certificate_url: ex.degreeCertificateUrl,
          aadhar_url: ex.aadharUrl,
          created_at: ex.createdAt,
          updated_at: ex.updatedAt,
        },
      })),
    };
  }

  async approveExpert(id: string) {
    const user = await this.userRepo.findOne({
      where: { id: Number(id), role: UserRole.EXPERT },
    });
    if (!user) throw new NotFoundException('Expert not found');
    user.expertStatus = ExpertStatus.APPROVED;
    await this.userRepo.save(user);
    return { message: 'Expert approved', id };
  }

  async rejectExpert(id: string) {
    const user = await this.userRepo.findOne({
      where: { id: Number(id), role: UserRole.EXPERT },
    });
    if (!user) throw new NotFoundException('Expert not found');
    user.expertStatus = ExpertStatus.REJECTED;
    await this.userRepo.save(user);
    return { message: 'Expert rejected', id };
  }

  async listSellers() {
    const sellers = await this.adminRepo.find({
      where: { role: AdminRole.SELLER },
      order: { createdAt: 'DESC' },
    });
    return {
      sellers: sellers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        created_at: s.createdAt,
      })),
    };
  }

  async createSeller(name: string, email: string, password: string) {
    const existing = await this.adminRepo.findOne({ where: { email: email.trim() } });
    if (existing) throw new ConflictException('Email already registered');
    if (password.length < 8) throw new UnauthorizedException('Password must be at least 8 characters');
    if (!name?.trim() || !email?.trim()) throw new UnauthorizedException('Name and email required');
    const hash = await bcrypt.hash(password, 12);
    const admin = this.adminRepo.create({
      name: name.trim(),
      email: email.trim(),
      passwordHash: hash,
      role: AdminRole.SELLER,
    });
    const saved = await this.adminRepo.save(admin);
    return {
      message: 'Seller created',
      user: { id: saved.id, name: saved.name, email: saved.email, role: saved.role },
    };
  }
}
