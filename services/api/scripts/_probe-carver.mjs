const suffixes = ['', '_a', '_b', '_c', '_d'];
function strip(html) {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
(async () => {
  let text = '';
  for (const s of suffixes) {
    const url = `https://lib-ebooks.com/read_online/book_what-we-talk-about-when-we-talk-about-love-stories_92728${s}`;
    const html = await (await fetch(url)).text();
    text += ' ' + strip(html);
  }
  const idx = text.indexOf('My friend Mel McGinnis was talking');
  const idx2 = text.indexOf('Vitamins', idx + 100);
  const story = text.slice(idx, idx2 > 0 ? idx2 : idx + 12000);
  console.log('start', idx, 'end', idx2, 'words', (story.match(/[\p{L}\p{M}']+/gu) ?? []).length);
  console.log(story.slice(0, 250));
  console.log('...');
  console.log(story.slice(-250));
})();
