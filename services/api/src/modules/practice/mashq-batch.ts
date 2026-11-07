import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { uzOrthography } from '@gotcha/shared';
import OpenAI from 'openai';
import { ageBand } from '../../common/safety/age-policy';
import { PrismaService } from '../../prisma/prisma.service';
import { withChildSafe } from '../ai/ai-safety';
import { openAiChatModel, openAiChatSampling } from '../ai/openai-chat';
import { AiService } from '../ai/ai.service';
import {
  acceptPageQuiz,
  foldSpace,
  PAGE_QUIZ_SYSTEM,
  PAGE_QUIZ_USER_LEAD,
  pageQuizUserContent,
  readingPassage,
  type PageBankItem,
} from '../ai/quiz-grounding';

/** Batch budget guard. The Batch API bills half the configured chat rate. */
export const MASHQ_BATCH_USD_PER_1M_IN = 0.2;
export const MASHQ_BATCH_USD_PER_1M_OUT = 0.8;
export const MASHQ_BATCH_BUDGET_USD = 40;
/** Existing banks average 799 characters per question. 2.5 characters per token is the cautious mixed-script bound. */
const OUTPUT_CHARS_PER_QUESTION = 799;
const OUTPUT_CHARS_PER_TOKEN = 2.5;
const INPUT_CHARS_PER_TOKEN = 4;
const CHUNK = 4000;

export function pageQuizBatchSystem(env: Record<string, string | undefined> = process.env): string {
  return withChildSafe(PAGE_QUIZ_SYSTEM, ageBand(null, new Date(), env));
}

/** Conservative USD for one batch call. Live retries cost twice this. */
export function projectPageQuizUsd(pageChars: number, env: Record<string, string | undefined> = process.env): number {
  const inputChars = pageQuizBatchSystem(env).length + PAGE_QUIZ_USER_LEAD.length + 12 + Math.min(4000, Math.max(0, pageChars));
  const inputTokens = inputChars / INPUT_CHARS_PER_TOKEN;
  const outputTokens = (8 * OUTPUT_CHARS_PER_QUESTION) / OUTPUT_CHARS_PER_TOKEN;
  return (inputTokens * MASHQ_BATCH_USD_PER_1M_IN + outputTokens * MASHQ_BATCH_USD_PER_1M_OUT) / 1e6;
}

export function projectMashqBatchUsd(pageChars: number[], env: Record<string, string | undefined> = process.env) {
  const usd = pageChars.reduce((sum, chars) => sum + projectPageQuizUsd(chars, env), 0);
  return { requests: pageChars.length, usd: Number(usd.toFixed(2)) };
}

interface BatchRow {
  id: string;
  fileId: string;
  count: number;
  status: string;
  inserted: number;
  failed: number;
  costUsd: number;
  outputDone?: boolean;
}

interface MashqState {
  total: number;
  projectionUsd: number;
  stopped: string | null;
  costUsd: number;
  done: number;
  failed: number;
  nextOffset: number;
  submitFinished: boolean;
  queue: string[];
  batches: BatchRow[];
  retries: string[];
}

function emptyState(): MashqState {
  return { total: 0, projectionUsd: 0, stopped: null, costUsd: 0, done: 0, failed: 0, nextOffset: 0, submitFinished: false, queue: [], batches: [], retries: [] };
}

@Injectable()
export class MashqBatchRunner {
  private readonly logger = new Logger('MashqBatch');
  private busy = false;
  private readonly statePath = join(process.cwd(), 'mashq-batch-state.json');
  private readonly progressPath = join(process.cwd(), 'mashq-progress.json');

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.run();
    } catch (error) {
      this.logger.warn(`mashq batch tick failed: ${error instanceof Error ? error.message : 'error'}`);
    } finally {
      this.busy = false;
    }
  }

  private client(): OpenAI | null {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
  }

  private async load(): Promise<MashqState> {
    try {
      return JSON.parse(await fs.readFile(this.statePath, 'utf8')) as MashqState;
    } catch {
      return emptyState();
    }
  }

  private async save(state: MashqState) {
    await fs.writeFile(this.statePath, JSON.stringify(state));
    await fs.writeFile(this.progressPath, JSON.stringify({
      done: state.done,
      total: state.total,
      failed: state.failed,
      costUsd: Number(state.costUsd.toFixed(4)),
      projectionUsd: state.projectionUsd,
      stopped: state.stopped,
      batches: state.batches.map((batch) => ({ id: batch.id, status: batch.status, count: batch.count })),
    }));
  }

  private async missing() {
    return this.prisma.contentSegment.findMany({
      where: {
        wordCount: { gte: 60 },
        pageQuestions: { none: { status: 'active' } },
        content: {
          publishStatus: 'published',
          contentSource: { not: 'user_import' },
          contentType: { not: 'user_import' },
        },
      },
      select: { id: true, contentId: true, plainText: true },
    });
  }

  private async run() {
    const state = await this.load();
    if (state.stopped === 'over_budget') {
      await this.save(state);
      return;
    }
    const openai = this.client();
    if (!openai) return;
    if (!state.stopped && !state.submitFinished) await this.submit(state, openai);
    for (const batch of state.batches) {
      if (batch.outputDone || batch.status === 'failed' || batch.status === 'expired' || batch.status === 'cancelled') continue;
      await this.poll(state, openai, batch);
    }
    await this.retryLive(state);
    await this.save(state);
  }

  private async submit(state: MashqState, openai: OpenAI) {
    if (!state.queue.length) {
      const rows = await this.missing();
      const pages = rows.map((row) => readingPassage(row.plainText).slice(0, 4000).length);
      const projection = projectMashqBatchUsd(pages);
      state.total = rows.length;
      state.projectionUsd = projection.usd;
      state.queue = rows.map((row) => row.id);
      if (projection.usd > MASHQ_BATCH_BUDGET_USD) {
        state.stopped = 'over_budget';
        state.submitFinished = true;
        this.logger.warn(`mashq batch projection $${projection.usd} is over $${MASHQ_BATCH_BUDGET_USD}; not submitted`);
        await this.save(state);
        return;
      }
      await this.save(state);
    }
    const system = pageQuizBatchSystem();
    const quizModel = openAiChatModel(process.env.OPENAI_MODEL_QUIZ);
    const quizSampling = openAiChatSampling(quizModel, { temperature: 0.2 });
    while (state.nextOffset < state.queue.length) {
      const ids = state.queue.slice(state.nextOffset, state.nextOffset + CHUNK);
      const slice = await this.prisma.contentSegment.findMany({
        where: { id: { in: ids } },
        select: { id: true, plainText: true },
      });
      const byId = new Map(slice.map((row) => [row.id, row]));
      const lines = ids.filter((id) => byId.has(id)).map((id) => {
        const row = byId.get(id)!;
        return JSON.stringify({
        custom_id: row.id,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: quizModel,
          ...quizSampling,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: pageQuizUserContent(readingPassage(row.plainText).slice(0, 4000)) },
          ],
        },
      });
      });
      const path = join(tmpdir(), `gotcha-mashq-${state.nextOffset}.jsonl`);
      await fs.writeFile(path, lines.join('\n'));
      try {
        const file = await openai.files.create({ file: createReadStream(path), purpose: 'batch' });
        const batch = await openai.batches.create({
          input_file_id: file.id,
          endpoint: '/v1/chat/completions',
          completion_window: '24h',
        });
        state.batches.push({
          id: batch.id,
          fileId: file.id,
          count: ids.length,
          status: batch.status,
          inserted: 0,
          failed: 0,
          costUsd: 0,
        });
        state.nextOffset += ids.length;
        this.logger.log(`mashq batch submitted ${batch.id} requests=${ids.length}`);
        await this.save(state);
      } finally {
        await fs.unlink(path).catch(() => undefined);
      }
    }
    state.submitFinished = true;
    await this.save(state);
  }

  private async poll(state: MashqState, openai: OpenAI, batch: BatchRow) {
    const remote = await openai.batches.retrieve(batch.id);
    batch.status = remote.status;
    if (remote.status !== 'completed' || !remote.output_file_id || batch.outputDone) return;
    const file = await openai.files.content(remote.output_file_id);
    const text = await file.text();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      await this.consumeLine(state, batch, line);
    }
    batch.outputDone = true;
    await this.save(state);
  }

  private async consumeLine(state: MashqState, batch: BatchRow, line: string) {
    let row: { custom_id?: string; response?: { status_code?: number; body?: { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } } }; error?: unknown };
    try {
      row = JSON.parse(line) as typeof row;
    } catch {
      state.failed += 1;
      batch.failed += 1;
      return;
    }
    const usage = row.response?.body?.usage;
    if (usage) {
      const usd = ((usage.prompt_tokens ?? 0) * MASHQ_BATCH_USD_PER_1M_IN + (usage.completion_tokens ?? 0) * MASHQ_BATCH_USD_PER_1M_OUT) / 1e6;
      state.costUsd += usd;
      batch.costUsd += usd;
    }
    const segmentId = row.custom_id ?? '';
    if (row.error || row.response?.status_code !== 200) {
      state.retries.push(segmentId);
      return;
    }
    const segment = await this.prisma.contentSegment.findUnique({
      where: { id: segmentId },
      select: { id: true, contentId: true, plainText: true, pageQuestions: { where: { status: 'active' }, select: { id: true } } },
    });
    if (!segment) {
      state.failed += 1;
      batch.failed += 1;
      return;
    }
    if (segment.pageQuestions.length) {
      state.done += 1;
      return;
    }
    let questions: unknown;
    try {
      questions = JSON.parse(row.response?.body?.choices?.[0]?.message?.content ?? '{}').questions;
    } catch {
      questions = null;
    }
    const items = acceptPageQuiz(questions, segment.plainText);
    if (!items) {
      state.retries.push(segmentId);
      return;
    }
    await this.insert(segment, items);
    state.done += 1;
    batch.inserted += 1;
  }

  /** Catalog pages are filled by the agent importer. Live OpenAI retries are off. */
  private async retryLive(state: MashqState) {
    if (state.retries.length) {
      this.logger.log(`mashq live retry is off; ${state.retries.length} pages stay for the agent importer`);
    }
  }

  private async insert(segment: { id: string; contentId: string; plainText: string }, items: PageBankItem[]) {
    const hash = createHash('sha256').update(segment.plainText).digest('hex');
    const plain = foldSpace(segment.plainText);
    for (const item of items) {
      const quote = foldSpace(item.evidenceQuote);
      const at = plain.toLowerCase().indexOf(quote.toLowerCase());
      await this.prisma.pageQuestion.create({
        data: {
          segmentId: segment.id,
          contentId: segment.contentId,
          segmentHash: hash,
          promptI18n: { ...item.prompt, uz: uzOrthography(item.prompt.uz) },
          optionsI18n: { ...item.options, uz: item.options.uz.map((option) => uzOrthography(option)) },
          answerIndex: item.answerIndex,
          evidenceQuote: item.evidenceQuote,
          evidenceStart: Math.max(0, at),
          evidenceEnd: at < 0 ? 0 : at + quote.length,
          explanationI18n: { ...item.explanation, uz: uzOrthography(item.explanation.uz) },
          generatorVersion: 'openai-batch',
          status: 'active',
        },
      });
    }
    await this.prisma.contentSegment.update({
      where: { id: segment.id },
      data: { quizReadyCount: items.length },
    });
  }
}
