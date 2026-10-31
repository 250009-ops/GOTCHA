import { extractSourceDocument } from '../src/modules/admin/content-ingest.ts';

const SOURCES = [
  ['Пиковая дама', 'https://ru.wikisource.org/wiki/%D0%9F%D0%B8%D0%BA%D0%BE%D0%B2%D0%B0%D1%8F_%D0%B4%D0%B0%D0%BC%D0%B0_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)'],
  ['Шинель', 'https://ru.wikisource.org/wiki/%D0%A8%D0%B8%D0%BD%D0%B5%D0%BB%D1%8C_(%D0%93%D0%BE%D0%B3%D0%BE%D0%BB%D1%8C)'],
  ['Белые ночи', 'https://ru.wikisource.org/wiki/%D0%91%D0%B5%D0%BB%D1%8B%D0%B5_%D0%BD%D0%BE%D1%87%D0%B8_(%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9)'],
  ['Каштанка', 'https://ru.wikisource.org/wiki/%D0%9A%D0%B0%D1%88%D1%82%D0%B0%D0%BD%D0%BA%D0%B0_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)'],
  ['Смерть Ивана Ильича', 'https://ru.wikisource.org/wiki/%D0%A1%D0%BC%D0%B5%D1%80%D1%82%D1%8C_%D0%98%D0%B2%D0%B0%D0%BD%D0%B0_%D0%98%D0%BB%D1%8C%D0%B8%D1%87%D0%B0_(%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9)'],
  ['Нос', 'https://ru.wikisource.org/wiki/%D0%9D%D0%BE%D1%81_(%D0%93%D0%BE%D0%B3%D0%BE%D0%BB%D1%8C)'],
  ['Дама с собачкой', 'https://ru.wikisource.org/wiki/%D0%94%D0%B0%D0%BC%D0%B0_%D1%81_%D1%81%D0%BE%D0%B1%D0%B0%D1%87%D0%BA%D0%BE%D0%B9_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)'],
  ['Первая любовь', 'https://ru.wikisource.org/wiki/%D0%9F%D0%B5%D1%80%D0%B2%D0%B0%D1%8F_%D0%BB%D1%8E%D0%B1%D0%BE%D0%B2%D1%8C_(%D0%A2%D1%83%D1%80%D0%B3%D0%B5%D0%BD%D0%B5%D0%B2)'],
  ['Человек в футляре', 'https://ru.wikisource.org/wiki/%D0%A7%D0%B5%D0%BB%D0%BE%D0%B2%D0%B5%D0%BA_%D0%B2_%D1%84%D1%83%D1%82%D0%BB%D1%8F%D1%80%D0%B5_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)'],
  ['Сон смешного человека', 'https://ru.wikisource.org/wiki/%D0%A1%D0%BE%D0%BD_%D1%81%D0%BC%D0%B5%D1%88%D0%BD%D0%BE%D0%B3%D0%BE_%D1%87%D0%B5%D0%BB%D0%BE%D0%B2%D0%B5%D0%BA%D0%B0_(%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9)'],
  ['Палата № 6', 'https://ru.wikisource.org/wiki/%D0%9F%D0%B0%D0%BB%D0%B0%D1%82%D0%B0_%E2%84%96_6_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)'],
  ['Станционный смотритель', 'https://ru.wikisource.org/wiki/%D0%A1%D1%82%D0%B0%D0%BD%D1%86%D0%B8%D0%BE%D0%BD%D0%BD%D1%8B%D0%B9_%D1%81%D0%BC%D0%BE%D1%82%D1%80%D0%B8%D1%82%D0%B5%D0%BB%D1%8C_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)'],
  ['Выстрел', 'https://ru.wikisource.org/wiki/%D0%92%D1%8B%D1%81%D1%82%D1%80%D0%B5%D0%BB_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)'],
  ['Муму', 'https://ru.wikisource.org/wiki/%D0%9C%D1%83%D0%BC%D1%83_(%D0%A2%D1%83%D1%80%D0%B3%D0%B5%D0%BD%D0%B5%D0%B2)'],
  ['Портрет', 'https://ru.wikisource.org/wiki/%D0%9F%D0%BE%D1%80%D1%82%D1%80%D0%B5%D1%82_(%D0%93%D0%BE%D0%B3%D0%BE%D0%BB%D1%8C)'],
  ['Леди Макбет Мценского уезда', 'https://ru.wikisource.org/wiki/%D0%9B%D0%B5%D0%B4%D0%B8_%D0%9C%D0%B0%D0%BA%D0%B1%D0%B5%D1%82_%D0%9C%D1%86%D0%B5%D0%BD%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_%D1%83%D0%B5%D0%B7%D0%B4%D0%B0_(%D0%9B%D0%B5%D1%81%D0%BA%D0%BE%D0%B2)'],
  ['Хозяин и работник', 'https://ru.wikisource.org/wiki/%D0%A5%D0%BE%D0%B7%D1%8F%D0%B8%D0%BD_%D0%B8_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BD%D0%B8%D0%BA_(%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9)'],
  ['Крейцерова соната', 'https://ru.wikisource.org/wiki/%D0%9A%D1%80%D0%B5%D0%B9%D1%86%D0%B5%D1%80%D0%BE%D0%B2%D0%B0_%D1%81%D0%BE%D0%BD%D0%B0%D1%82%D0%B0_(%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9)'],
  ['Ася', 'https://ru.wikisource.org/wiki/%D0%90%D1%81%D1%8F_(%D0%A2%D1%83%D1%80%D0%B3%D0%B5%D0%BD%D0%B5%D0%B2)'],
  ['Чёрный монах', 'https://ru.wikisource.org/wiki/%D0%A7%D1%91%D1%80%D0%BD%D1%8B%D0%B9_%D0%BC%D0%BE%D0%BD%D0%B0%D1%85_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)'],
];

for (const [title, url] of SOURCES) {
  try {
    const doc = await extractSourceDocument({ sourceUrl: url, title, language: 'ru' });
    const words = (doc.text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
    console.log('OK', title, words, 'chapters', doc.chapters.length, 'end:', doc.text.slice(-80).replace(/\s+/g, ' '));
  } catch (e) {
    console.log('FAIL', title, e instanceof Error ? e.message : e);
  }
}
