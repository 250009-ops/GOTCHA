// covers-01 layout harness: renders BookCover for many titles × widths in a real browser (fonts from Google, as in prod).
import { createRoot } from 'react-dom/client';
import { BookCover, heroTitleStyle, coverDisplayTitle } from '../../src/components/cover/BookCover';

export const TITLES: Array<{ title: string; language: string; author: string; genre?: string }> = [
  { title: 'Semaver', language: 'tr', author: 'Sait Faik Abasıyanık' },
  { title: 'Crime and Punishment', language: 'en', author: 'Fyodor Dostoevsky', genre: 'classic' },
  { title: 'The Strange Case of Dr Jekyll and Mr Hyde and Other Tales of Terror', language: 'en', author: 'Robert Louis Stevenson' },
  { title: 'Преступление и наказание', language: 'ru', author: 'Фёдор Достоевский' },
  { title: 'Удивительное путешествие Нильса Хольгерссона с дикими гусями по Швеции', language: 'ru', author: 'Сельма Лагерлёф' },
  { title: 'Oʻtkan kunlar', language: 'uz', author: 'Abdulla Qodiriy' },
  { title: "Sarob va gʻalaba haqida oʻzbek xalq ertaklari toʻplami (ikkinchi nashr)", language: 'uz', author: 'Gʻafur Gʻulom' },
  { title: 'Kecha va kunduz', language: 'uz', author: 'Choʻlpon' },
  { title: 'Supercalifragilisticexpialidocious', language: 'en', author: 'Anon' },
  { title: 'Der Schimmelreiter', language: 'de', author: 'Theodor Storm' },
];
export const CARD_WIDTHS = [136, 149, 150, 170, 213];

function App() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12, background: '#EEF0FB' }}>
      {TITLES.flatMap((t, i) =>
        CARD_WIDTHS.map((w) => (
          <div key={`${i}-${w}`} data-case={`card|${i}|${w}`} style={{ width: w }}>
            <BookCover item={{ ...t, authorName: t.author, coverMode: 'template' }} className="" variant="card" />
          </div>
        )),
      )}
      {TITLES.map((t, i) =>
        [320, 358, 640].map((w) => (
          <div key={`h${i}-${w}`} data-case={`hero|${i}|${w}`} style={{ width: w, height: 220, position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
            <BookCover item={{ ...t, coverMode: 'template' }} variant="hero" className="" />
            <div style={{ position: 'absolute', left: 20, right: 20, bottom: 20 }}>
              <div className="hero-title" lang={t.language} style={{ ...heroTitleStyle(coverDisplayTitle(t)), color: '#fff' }}>{coverDisplayTitle(t)}</div>
            </div>
          </div>
        )),
      )}
      {TITLES.slice(0, 3).map((t, i) => (
        <div key={`t${i}`} data-case={`thumb|${i}|52`} style={{ width: 52 }}>
          <BookCover item={{ ...t, coverMode: 'template' }} variant="thumb" className="" />
        </div>
      ))}
    </div>
  );
}
const style = document.createElement('style');
style.textContent = '[data-case^=card] .gc-cover,[data-case^=thumb] .gc-cover{aspect-ratio:3/4;width:100%}[data-case^=hero] .gc-cover{position:absolute;inset:0}';
document.head.appendChild(style);
createRoot(document.getElementById('root')!).render(<App />);
