import * as assert from 'node:assert/strict';
import { Logger } from '@nestjs/common';
import {
  applyCustomEmoji,
  CODE_EMOJI_KEYS,
  CUSTOM_EMOJI_FALLBACK,
  logIncomingCustomEmoji,
  notificationEmojiKeys,
  WELCOME_EMOJI_KEYS,
  type BotEntity,
  type CustomEmojiKey,
} from './custom-emoji';
import { loginCodeHtml, notificationHtml, signupCodeText, welcomeHtml, type BotLocale } from './copy';
import { GrammySender, welcomeImagePath } from './telegram-api';
import { TelegramBotService } from './telegram-bot.service';

const IDS: Record<CustomEmojiKey, string> = {
  wave: '1001',
  book: '1002',
  tap: '1003',
  brain: '1004',
  fire: '1005',
  key: '1006',
  check: '1007',
};

interface Sample {
  name: string;
  html: string;
  keys: readonly CustomEmojiKey[];
  photo?: boolean;
  includes: string[];
}

function samples(): Sample[] {
  const locales: BotLocale[] = ['uz', 'ru', 'en'];
  const list: Sample[] = [];
  for (const locale of locales) {
    const hello = locale === 'ru' ? 'Здравствуйте, Dilnoza!' : locale === 'en' ? 'Hello, Dilnoza!' : 'Assalomu alaykum, Dilnoza!';
    list.push({
      name: `welcome ${locale}`,
      html: welcomeHtml(locale, 'Dilnoza'),
      keys: WELCOME_EMOJI_KEYS,
      photo: true,
      includes: [hello, 'gotchaa.uz'],
    });
    list.push({
      name: `signup ${locale}`,
      html: signupCodeText(locale, '482913'),
      keys: CODE_EMOJI_KEYS,
      includes: ['482 913'],
    });
    list.push({
      name: `login ${locale}`,
      html: loginCodeHtml(locale, '482913'),
      keys: CODE_EMOJI_KEYS,
      includes: ['<b>482 913</b>'],
    });
  }
  const notes = [
    ['content', 'Kutubxonada yangi kitob', '«Animal Farm» endi oʻqishga tayyor.'],
    ['goal', 'Kunlik oʻqish maqsadi', 'Bugungi 20 daqiqalik maqsadga 8 daqiqa qoldi.'],
    ['vocab', 'Soʻzlarni takrorlash tayyor', '13 ta soʻz SRS takroriga tayyor.'],
    ['message', 'Maya Tsel dan yangi xabar', 'Have you finished the chapter?'],
    ['streak', '5 kunlik seriyangizni yoʻqotmang!', 'Dilnoza, seriyani saqlab qolish uchun bugun bir necha daqiqa oʻqing.'],
  ] as const;
  for (const [kind, title, body] of notes) {
    list.push({
      name: `notify ${kind}`,
      html: notificationHtml(kind, title, body),
      keys: notificationEmojiKeys(kind),
      includes: [`<b>${title}</b>`, body],
    });
  }
  list.push({
    name: 'notify same title',
    html: notificationHtml('streak', 'Same', 'Same'),
    keys: notificationEmojiKeys('streak'),
    includes: [`${CUSTOM_EMOJI_FALLBACK.fire} Same`],
  });
  list.push({
    name: 'notify escaped',
    html: notificationHtml('content', 'A & B <C>', '1 > 0'),
    keys: notificationEmojiKeys('content'),
    includes: ['A &amp; B &lt;C&gt;', '1 &gt; 0'],
  });
  return list;
}

function fakeSender() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const sender = new GrammySender('123456:TEST');
  const api = {
    sendMessage: async (...args: unknown[]) => {
      calls.push({ method: 'sendMessage', args });
      return {};
    },
    sendPhoto: async (...args: unknown[]) => {
      calls.push({ method: 'sendPhoto', args });
      return {};
    },
  };
  (sender as unknown as { bot: { api: typeof api } }).bot = { api };
  return { sender, calls };
}

function payload(call: { method: string; args: unknown[] }) {
  const other = (call.args[2] ?? {}) as Record<string, unknown>;
  const text = (call.method === 'sendPhoto' ? other.caption : call.args[1]) as string;
  const entities = (call.method === 'sendPhoto' ? other.caption_entities : other.entities) as BotEntity[] | undefined;
  return { text, other, entities };
}

function overlaps(a: BotEntity, b: BotEntity) {
  return a.offset < b.offset + b.length && b.offset < a.offset + a.length;
}

async function sendAll(prepared: Array<{ text: string; entities?: BotEntity[]; photo?: boolean }>) {
  const { sender, calls } = fakeSender();
  for (const item of prepared) {
    const result = await sender.send(1, item.text, [[{ text: 'Open', callback: 'ok:1' }]], item.photo, item.entities);
    assert.equal(result.status, 'ok');
  }
  return calls;
}

async function main() {
  const savedIds = process.env.TELEGRAM_CUSTOM_EMOJI_IDS;
  const savedNodeEnv = process.env.NODE_ENV;
  const originalLog = Logger.prototype.log;
  try {
    delete process.env.TELEGRAM_CUSTOM_EMOJI_IDS;
    const plain = samples();
    assert.equal(plain.length, 16);
    for (const sample of plain) {
      const rendered = applyCustomEmoji(sample.html, sample.keys);
      assert.equal(rendered.entities, undefined, `${sample.name} should stay HTML`);
      assert.equal(rendered.text, sample.html);
      for (const key of sample.keys) assert.ok(sample.html.includes(CUSTOM_EMOJI_FALLBACK[key]), sample.name);
      for (const part of sample.includes) assert.ok(sample.html.includes(part), `${sample.name} missing ${part}`);
    }

    const plainCalls = await sendAll(plain.map((sample) => ({ text: sample.html, photo: sample.photo })));
    assert.equal(plainCalls.length, plain.length);
    plain.forEach((sample, index) => {
      const call = plainCalls[index];
      const expectPhoto = Boolean(sample.photo && welcomeImagePath());
      assert.equal(call.method, expectPhoto ? 'sendPhoto' : 'sendMessage', sample.name);
      const { text, other, entities } = payload(call);
      assert.equal(text, sample.html, sample.name);
      assert.equal(other.parse_mode, 'HTML', sample.name);
      assert.equal(entities, undefined, sample.name);
      assert.equal(other.entities, undefined, sample.name);
      assert.equal(other.caption_entities, undefined, sample.name);
      assert.ok(other.reply_markup, sample.name);
    });

    process.env.TELEGRAM_CUSTOM_EMOJI_IDS = '{';
    assert.equal(applyCustomEmoji(plain[0].html, plain[0].keys).entities, undefined);

    process.env.TELEGRAM_CUSTOM_EMOJI_IDS = JSON.stringify({ wave: 1001, book: 'nope' });
    assert.equal(applyCustomEmoji(welcomeHtml('uz', 'Dilnoza'), WELCOME_EMOJI_KEYS).entities, undefined);

    process.env.TELEGRAM_CUSTOM_EMOJI_IDS = JSON.stringify(IDS);
    const customCalls = await sendAll(plain.map((sample) => {
      const rendered = applyCustomEmoji(sample.html, sample.keys);
      return { text: rendered.text, entities: rendered.entities, photo: sample.photo };
    }));
    plain.forEach((sample, index) => {
      const call = customCalls[index];
      const { text, other, entities } = payload(call);
      assert.equal(other.parse_mode, undefined, sample.name);
      assert.ok(entities?.length, sample.name);
      assert.equal(text.includes('<b>'), false, sample.name);
      assert.equal(text.includes('&amp;'), false, sample.name);
      assert.equal(text.includes('&lt;'), false, sample.name);
      assert.equal(text.includes('&gt;'), false, sample.name);
      const customs = entities.filter((entity) => entity.type === 'custom_emoji');
      const bolds = entities.filter((entity) => entity.type === 'bold');
      assert.equal(customs.length, sample.keys.length, sample.name);
      for (const key of sample.keys) {
        const emoji = CUSTOM_EMOJI_FALLBACK[key];
        const entity = customs.find((item) => item.custom_emoji_id === IDS[key]);
        assert.ok(entity, `${sample.name} ${key}`);
        assert.equal(entity.length, emoji.length);
        assert.equal(text.slice(entity.offset, entity.offset + entity.length), emoji);
      }
      for (const custom of customs) {
        for (const bold of bolds) assert.equal(overlaps(custom, bold), false, sample.name);
      }
      for (const bold of bolds) {
        const slice = text.slice(bold.offset, bold.offset + bold.length);
        assert.ok(slice.length > 0);
        assert.equal(slice.includes('<b>'), false);
        assert.equal(slice.includes('</b>'), false);
      }
    });

    const login = applyCustomEmoji(loginCodeHtml('uz', '482913'), CODE_EMOJI_KEYS);
    const codeBold = login.entities?.find((entity) => entity.type === 'bold' && login.text.slice(entity.offset, entity.offset + entity.length) === '482 913');
    assert.ok(codeBold);

    const escaped = applyCustomEmoji(notificationHtml('content', 'A & B <C>', '1 > 0'), notificationEmojiKeys('content'));
    assert.ok(escaped.text.includes('A & B <C>'));
    assert.ok(escaped.text.includes('1 > 0'));

    const named = applyCustomEmoji(welcomeHtml('en', 'A & B'), WELCOME_EMOJI_KEYS);
    assert.ok(named.text.includes('Hello, A & B!'));
    assert.equal(named.text.includes('&amp;'), false);

    const lines: string[] = [];
    logIncomingCustomEmoji({
      message: {
        text: 'do not log this sentence',
        chat: { id: 99 },
        entities: [
          { type: 'custom_emoji', offset: 0, length: 2, custom_emoji_id: '111' },
          { type: 'bold', offset: 3, length: 1 },
          { type: 'custom_emoji', offset: 4, length: 2, custom_emoji_id: 'not-an-id' },
        ],
        sticker: { type: 'custom_emoji', custom_emoji_id: '222', emoji: '👋' },
      },
    }, (line) => lines.push(line));
    assert.deepEqual(lines, ['custom_emoji_id 111', 'custom_emoji_id 222']);
    assert.equal(lines.join(' ').includes('do not log'), false);
    assert.equal(lines.join(' ').includes('99'), false);

    process.env.NODE_ENV = 'production';
    const hidden: string[] = [];
    logIncomingCustomEmoji({
      message: { text: 'secret phrase', entities: [{ type: 'custom_emoji', custom_emoji_id: '555' }] },
    }, (line) => hidden.push(line));
    assert.deepEqual(hidden, []);

    const logged: string[] = [];
    Logger.prototype.log = function (message?: unknown) {
      logged.push(String(message));
    };
    const service = new TelegramBotService({} as never, {} as never);
    await service.handleUpdate({
      message: {
        text: 'secret phrase',
        from: { id: 7 },
        entities: [{ type: 'custom_emoji', offset: 0, length: 2, custom_emoji_id: '444' }],
      },
    });
    assert.deepEqual(logged, []);

    process.env.NODE_ENV = 'development';
    await service.handleUpdate({
      message: {
        text: 'secret phrase',
        from: { id: 7 },
        entities: [{ type: 'custom_emoji', offset: 0, length: 2, custom_emoji_id: '444' }],
      },
    });
    assert.deepEqual(logged, ['custom_emoji_id 444']);
    assert.equal(logged.join(' ').includes('secret'), false);

    console.log('custom-emoji.test.ts ok');
  } finally {
    Logger.prototype.log = originalLog;
    if (savedIds === undefined) delete process.env.TELEGRAM_CUSTOM_EMOJI_IDS;
    else process.env.TELEGRAM_CUSTOM_EMOJI_IDS = savedIds;
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
