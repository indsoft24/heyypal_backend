import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Public: list categories for app (explore, discover, expert onboarding). */
  @Get()
  @ApiOperation({ summary: 'List all categories (public)' })
  async list() {
    return this.categories.findAll();
  }
}
