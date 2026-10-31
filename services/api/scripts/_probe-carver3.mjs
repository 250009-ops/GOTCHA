const suffixes = ['', ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `_${c}`)];
for (const s of suffixes) {
  const html = await (await fetch(`https://lib-ebooks.com/read_online/book_what-we-talk-about-when-we-talk-about-love-stories_92728${s}`)).text();
  if (html.includes('Mel McGinnis')) {
    console.log('FOUND on page', s || 'root');
    break;
  }
}
