const html = await (await fetch('https://lib-ebooks.com/read_online/book_dont-look-now_201390_a')).text();
const paras = [...html.matchAll(/&nbsp;&nbsp;&nbsp;&nbsp;([^<]+)/g)];
console.log('paras', paras.length);
console.log(paras.slice(0, 2).map((p) => p[1].slice(0, 100)));
const carver = await (await fetch('https://lib-ebooks.com/read_online/book_what-we-talk-about-when-we-talk-about-love-stories_92728_b')).text();
console.log('carver Mel', carver.includes('Mel McGinnis'), carver.includes('cardiologist'));
console.log('carver sample', [...carver.matchAll(/&nbsp;&nbsp;&nbsp;&nbsp;([^<]+)/g)].slice(0,2));
