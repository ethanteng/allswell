import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_ANALYSIS_PROMPT, DEFAULT_FOLLOW_UP_PROMPT } from '../analysis/default-prompts';
import { DEFAULT_MODEL, isKnownModel, MODEL_CATALOG } from '../analysis/model-catalog';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdatePromptConfigDto } from './dto/admin.dto';

const CONFIG_ID = 'default';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads the singleton config, creating it from the shipped defaults on first
   * access so a fresh database doesn't need a seed step before the admin page
   * renders.
   */
  private async ensureConfig() {
    const existing = await this.prisma.promptConfig.findUnique({ where: { id: CONFIG_ID } });
    if (existing) return existing;

    return this.prisma.promptConfig.create({
      data: {
        id: CONFIG_ID,
        analysisPrompt: DEFAULT_ANALYSIS_PROMPT,
        followUpPrompt: DEFAULT_FOLLOW_UP_PROMPT,
        model: DEFAULT_MODEL,
      },
    });
  }

  async getConfig() {
    const config = await this.ensureConfig();

    return {
      config,
      models: MODEL_CATALOG,
      /** Lets the admin page show what a reset would restore. */
      shippedDefaults: {
        analysisPrompt: DEFAULT_ANALYSIS_PROMPT,
        followUpPrompt: DEFAULT_FOLLOW_UP_PROMPT,
        model: DEFAULT_MODEL,
      },
    };
  }

  async updateConfig(dto: UpdatePromptConfigDto, updatedBy: string) {
    await this.ensureConfig();

    if (dto.model !== undefined && !isKnownModel(dto.model)) {
      throw new BadRequestException(`Unknown model "${dto.model}"`);
    }

    const config = await this.prisma.promptConfig.update({
      where: { id: CONFIG_ID },
      data: {
        ...(dto.analysisPrompt !== undefined ? { analysisPrompt: dto.analysisPrompt } : {}),
        ...(dto.followUpPrompt !== undefined ? { followUpPrompt: dto.followUpPrompt } : {}),
        ...(dto.model !== undefined ? { model: dto.model } : {}),
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        // Bumped on every save so turns record which prompt produced them, and
        // the workspace can tell a clinician their analysis is out of date.
        version: { increment: 1 },
        updatedBy,
      },
    });

    return { config, models: MODEL_CATALOG };
  }
}
