for (const s of ['', '_a', '_b']) {
  const html = await (await fetch(`https://lib-ebooks.com/read_online/book_what-we-talk-about-when-we-talk-about-love-stories_92728${s}`)).text();
  console.log(s || 'root', {
    mel: html.includes('Mel McGinnis'),
    cardiologist: html.includes('cardiologist'),
    vitamins: html.includes('Vitamins'),
    firstPara: [...html.matchAll(/&nbsp;&nbsp;&nbsp;&nbsp;([^<]+)/g)][0]?.[1]?.slice(0, 80),
  });
}
