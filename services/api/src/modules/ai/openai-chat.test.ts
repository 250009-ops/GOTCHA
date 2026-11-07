import * as assert from 'node:assert/strict';
import { DEFAULT_OPENAI_CHAT_MODEL, openAiChatModel, openAiChatSampling } from './openai-chat';

assert.equal(DEFAULT_OPENAI_CHAT_MODEL, 'gpt-6-astra');
assert.equal(openAiChatModel(undefined, '  ', 'gpt-4.1-mini'), 'gpt-4.1-mini');
assert.equal(openAiChatModel(), 'gpt-6-astra');

const latest = openAiChatSampling('gpt-6-astra', { temperature: 0, maxTokens: 20 });
assert.deepEqual(latest, { max_completion_tokens: 276 });

const previous = openAiChatSampling('gpt-4.1-mini', { temperature: 0.2, maxTokens: 250 });
assert.deepEqual(previous, { temperature: 0.2, max_tokens: 250 });

console.log('openai-chat ok');
