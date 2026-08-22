import { ttsLangPrefix, ttsLocale } from '@gotcha/shared';
import { apiAudio } from './api';

let currentAudio: HTMLAudioElement | null = null;

function stopBrowserSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function stopSpeaking() {
  stopBrowserSpeech();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

function voiceMatches(voice: SpeechSynthesisVoice, lang: string): boolean {
  const wanted = ttsLangPrefix(lang);
  const voiceLang = (voice.lang || '').toLowerCase().replace(/_/g, '-');
  return voiceLang === wanted || voiceLang.startsWith(`${wanted}-`);
}

async function matchingVoice(lang: string): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const read = () => window.speechSynthesis.getVoices().filter((v) => voiceMatches(v, lang));
  const existing = read();
  if (existing.length) return pickBestVoice(existing, lang);
  const voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const finish = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
    window.setTimeout(finish, 400);
  });
  return pickBestVoice(voices.filter((v) => voiceMatches(v, lang)), lang);
}

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const locale = ttsLocale(lang).toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase().replace(/_/g, '-') === locale) ??
    voices.find((v) => v.localService) ??
    voices[0]
  );
}

/**
 * Speak a word/phrase in the content language.
 * Uses a matching browser voice when the OS has one (en, ru, …);
 * otherwise falls back to the API so Uzbek and other catalog languages still play.
 */
export async function speakText(text: string, lang: string): Promise<void> {
  const spoken = text.replace(/\s+/g, ' ').trim();
  if (!spoken) return;
  stopSpeaking();

  const voice = await matchingVoice(lang);
  if (voice && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.voice = voice;
    utterance.lang = voice.lang || ttsLocale(lang);
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
    return;
  }

  const blob = await apiAudio('/ai/speech', { text: spoken, lang: ttsLangPrefix(lang) });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  audio.onended = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
  await audio.play();
}
