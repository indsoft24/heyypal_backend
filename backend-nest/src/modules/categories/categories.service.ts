import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { ExpertCategory } from '../experts/entities/expert-profile.entity';

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  photoUrl?: string | null;
  shortDescription?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  photoUrl?: string | null;
  shortDescription?: string | null;
  sortOrder?: number;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async onModuleInit() {
    const count = await this.categoryRepo.count();
    if (count > 0) return;
    const defaults = Object.values(ExpertCategory).map((name, i) =>
      this.categoryRepo.create({
        name,
        slug: slugify(name),
        photoUrl: null,
        shortDescription: null,
        sortOrder: i,
      }),
    );
    await this.categoryRepo.save(defaults);
  }

  /** Public: list all categories for app explore/discover and expert form. */
  async findAll(): Promise<Category[]> {
    return this.categoryRepo.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /** Admin: list with optional search. */
  async findForAdmin(search?: string): Promise<Category[]> {
    const qb = this.categoryRepo
      .createQueryBuilder('c')
      .orderBy('c.sort_order', 'ASC')
      .addOrderBy('c.name', 'ASC');
    if (search?.trim()) {
      qb.andWhere(
        '(c.name ILIKE :q OR c.slug ILIKE :q OR c.short_description ILIKE :q)',
        { q: `%${search.trim()}%` },
      );
    }
    return qb.getMany();
  }

  async findById(id: number): Promise<Category> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.categoryRepo.findOne({ where: { slug } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const existing = await this.categoryRepo.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException(`Category with slug "${slug}" already exists`);
    }
    const cat = this.categoryRepo.create({
      name: dto.name.trim(),
      slug,
      photoUrl: dto.photoUrl?.trim() || null,
      shortDescription: dto.shortDescription?.trim() || null,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.categoryRepo.save(cat);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const cat = await this.findById(id);
    if (dto.name !== undefined) cat.name = dto.name.trim();
    if (dto.slug !== undefined) cat.slug = dto.slug.trim();
    if (dto.photoUrl !== undefined) cat.photoUrl = dto.photoUrl?.trim() || null;
    if (dto.shortDescription !== undefined)
      cat.shortDescription = dto.shortDescription?.trim() || null;
    if (dto.sortOrder !== undefined) cat.sortOrder = dto.sortOrder;
    return this.categoryRepo.save(cat);
  }

  async remove(id: number): Promise<void> {
    const cat = await this.findById(id);
    await this.categoryRepo.remove(cat);
  }
}
