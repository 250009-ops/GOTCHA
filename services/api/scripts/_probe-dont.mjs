const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const urls = [
  'https://biography.library.land/daphne-du-maurier/33489-dont_look_now.html',
  'https://lib-ebooks.com/read_online/book_dont-look-now_201390',
  'https://lib-ebooks.com/read_online/book_dont-look-now_201390_o',
  'https://lib-ebooks.com/read_online/book_dont-look-now_201390_p',
];
for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    console.log(url, res.status, (await res.text()).length);
  } catch (e) {
    console.log(url, 'ERR', e.message);
  }
}
