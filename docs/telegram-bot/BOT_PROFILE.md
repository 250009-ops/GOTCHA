# @gotchaa_app_bot — bot profile

Apply with the Bot API (Cursor: `deploy/telegram-bot-profile.ts`) and BotFather. Uzbek is the default (no `language_code`); ru and en use `language_code`.


## uz

**Name** (setMyName): Gotcha — til oʻrganish

**Short description / About** (setMyShortDescription, ≤120): Kitob, maqola va yangiliklarni oʻqib til oʻrganing. Istalgan soʻzga bosing — tarjima va izoh. gotchaa.uz

**Description** (setMyDescription, ≤512 — shown in the empty chat above Start):

```
Gotcha — oʻqish orqali til oʻrganish ilovasi.

Ingliz, nemis, koreys va boshqa tillarni sevgan kitob, maqola va yangiliklaringizni oʻqib oʻrganing:
• istalgan soʻzga bosing — tarjima va izoh darhol chiqadi;
• soʻzlar lugʻatingizga tushadi va Mashqda takrorlanadi;
• oʻz PDF, EPUB va maqolalaringizni yuklang.

Roʻyxatdan oʻtish 1 daqiqa: ism, Telegram raqamingiz va parol. Shu raqam bilan gotchaa.uz saytiga ham kirasiz.

Boshlash uchun «Start» tugmasini bosing.
```

**Command** (setMyCommands): `/start` — Gotchaʼni ochish


## ru

**Name** (setMyName): Gotcha — изучение языков

**Short description / About** (setMyShortDescription, ≤120): Учите языки, читая книги, статьи и новости. Нажмите на любое слово — перевод и пояснение. gotchaa.uz

**Description** (setMyDescription, ≤512 — shown in the empty chat above Start):

```
Gotcha — приложение для изучения языков через чтение.

Учите английский, немецкий, корейский и другие языки на любимых книгах, статьях и новостях:
• нажмите на любое слово — перевод и пояснение сразу;
• слова попадают в словарь и повторяются в Практике;
• загружайте свои PDF, EPUB и статьи.

Регистрация за 1 минуту: имя, номер Telegram и пароль. С этим номером вы войдёте и на gotchaa.uz.

Нажмите «Start», чтобы начать.
```

**Command** (setMyCommands): `/start` — Открыть Gotcha


## en

**Name** (setMyName): Gotcha — learn languages

**Short description / About** (setMyShortDescription, ≤120): Learn languages by reading books, articles and news. Tap any word for a translation and explanation. gotchaa.uz

**Description** (setMyDescription, ≤512 — shown in the empty chat above Start):

```
Gotcha is a language app built around reading.

Learn English, German, Korean and more from books, articles and news you enjoy:
• tap any word for an instant translation and explanation;
• words go to your vocabulary and come back in Practice;
• import your own PDFs, EPUBs and articles.

Sign up in a minute: name, your Telegram number and a password. Use the same number to sign in on gotchaa.uz.

Press Start to begin.
```

**Command** (setMyCommands): `/start` — Open Gotcha


## BotFather (by hand, once)

1. `/mybots` → @gotchaa_app_bot → **Edit Bot** → **Edit Botpic** → send `gotcha-bot-avatar-640.png`.
2. **Edit Bot** → **Edit Description Picture** → send `gotcha-bot-description-640x360.png`.
3. **Bot Settings** → **Allow Groups?** → Turn groups off. **Inline Mode** → leave off.
4. **Bot Settings** → **Configure Mini App** → **Enable Mini App**, URL `https://gotchaa.uz/learn/tg` (gives the "Open" button on the bot profile and `t.me/gotchaa_app?startapp=` links).
