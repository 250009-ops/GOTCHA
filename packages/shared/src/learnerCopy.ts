import { pluralEn, pluralRu } from './plural';
/** UI locale codes — keep in sync with UI_LANGUAGES in index.ts */
export type UiLanguage = 'en' | 'ru' | 'uz';

import { learnerCopyExtFor, type LearnerCopyExt } from './learnerCopyExt';

export type { LearnerCopyExt };
export type FullLearnerCopy = LearnerCopy & LearnerCopyExt;

export interface LearnerCopy {
  nav: {
    library: string;
    vocabulary: string;
    practice: string;
    import: string;
    statistics: string;
    notifications: string;
    messages: string;
    settings: string;
  };
  shell: {
    tagline: string;
    payAsYouGo: string;
    payAsYouGoHint: string;
    collapseSidebar: string;
    expandSidebar: string;
    notificationsAria: string;
    accountMenuAria: string;
    logOut: string;
    language: string;
  };
  common: {
    saveChanges: string;
    saving: string;
    back: string;
    continue: string;
    cancel: string;
    or: string;
    loading: string;
    seeAll: string;
    primary: string;
    verified: string;
    search: string;
    noResults: string;
    words: (count: number) => string;
    level: (cefr: string) => string;
    score: (n: number) => string;
  };
  auth: {
    welcomeBack: string;
    createAccount: string;
    whatToLearn: string;
    signInSubtitle: string;
    signInAdminSubtitle: string;
    signUpSubtitle: string;
    languageStepSubtitle: string;
    payPerImportBadge: string;
    freeForeverBadge: string;
    fullName: string;
    email: string;
    password: string;
    passwordPlaceholderLogin: string;
    passwordPlaceholderRegister: string;
    forgotPassword: string;
    signIn: string;
    signingIn: string;
    continuing: string;
    signUpFree: string;
    createFreeAccount: string;
    creatingAccount: string;
    noAccount: string;
    hasAccount: string;
    backToHomepage: string;
    hidePassword: string;
    showPassword: string;
    nativeLanguage: string;
    nativeLanguagePlaceholder: string;
    targetLanguages: string;
    targetLanguagesHint: string;
    targetLanguagesPlaceholder: string;
    legalPrefix: string;
    termsOfUse: string;
    legalAnd: string;
    privacyPolicy: string;
    legalSuffix: string;
    readYourWay: string;
    readYourWayBold: string;
    authTagline: string;
    authFeatures: Array<{ title: string; desc: string }>;
    learnersCount: (n: string) => string;
    alreadyReading: string;
    booksInLanguages: (langs: string) => string;
  };
  authToasts: {
    fillAllFields: string;
    passwordMinLength: string;
    pickNativeLanguage: string;
    pickTargetLanguage: string;
    welcomeBack: string;
    signedInLearner: string;
    noAdminAccess: string;
    checkInbox: string;
    accountCreated: string;
    verifyBeforeSignIn: string;
    accountExistsUnverified: string;
    accountExistsSignIn: string;
    authFailed: string;
  };
  settings: {
    title: string;
    subtitle: string;
    account: string;
    photo: string;
    photoHint: string;
    changePhoto: string;
    uploading: string;
    photoUpdated: string;
    uploadFailed: string;
    displayName: string;
    displayNameHint: string;
    displayNamePlaceholder: string;
    nativeLanguage: string;
    nativeLanguageHint: string;
    appLanguage: string;
    appLanguageHint: string;
    email: string;
    emailHint: string;
    password: string;
    changePassword: string;
    targetLanguages: string;
    noTargetLanguages: string;
    nativeCannotBeTarget: string;
    addLanguage: string;
    editTargetLanguage: string;
    addTargetLanguage: string;
    languageLabel: string;
    cefrLevel: string;
    setPrimary: string;
    saveLanguage: string;
    readingPreferences: string;
    preview: string;
    fontSize: string;
    fontSizeHint: (pct: number) => string;
    lineSpacing: string;
    lineSpacingHint: (n: string) => string;
    readerTheme: string;
    themeLight: string;
    themeSepia: string;
    themeDark: string;
    showKnownWords: string;
    showKnownWordsHint: string;
    tts: string;
    ttsHint: string;
    learningGoals: string;
    emailNotifications: string;
    emailNotificationsHint: string;
    usageImports: string;
    loadingUsage: string;
    freeAllowance: string;
    payPerImport: string;
    importMoreContent: string;
    aiLookupsToday: string;
    freeImportsToday: string;
    signedInAs: string;
    signOut: string;
    saved: string;
    saveFailed: string;
    fillPasswordFields: string;
    newPasswordMinLength: string;
    passwordsMismatch: string;
    passwordUpdated: string;
    passwordChangeFailed: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    updatePassword: string;
    targetSameAsNative: string;
    languageAdded: string;
    languageUpdated: string;
    languageSaveFailed: string;
    keepOneTarget: string;
    languageRemoved: string;
    languageRemoveFailed: string;
    removeLanguage: string;
    aiLookupsLine: (used: number, quota: string) => string;
    freeImportsLine: (remaining: number, total: number) => string;
    freePagesLine: (remaining: number, total: number, cycle: string) => string;
    publicLibraryAccess: string;
    importLimitLine: (limit: number) => string;
  };
  library: {
    title: string;
    browse: string;
    continueReading: string;
    recommended: string;
    allContent: string;
    searchPlaceholder: string;
    filterAll: string;
    filterFiction: string;
    filterNews: string;
    filterImports: string;
    filterA1A2: string;
    filterB1B2: string;
    filterC1C2: string;
    emptyTitle: string;
    emptyDescription: string;
    importAction: string;
    gridView: string;
    listView: string;
    backToLibrary: string;
    noResults: string;
    startReading: string;
    resumeReading: string;
  };
  vocabulary: {
    title: string;
    subtitle: string;
    dueForReview: string;
    allWords: string;
    mastered: string;
    learning: string;
    noWordsTitle: string;
    noWordsDescription: string;
    startReading: string;
    again: string;
    hard: string;
    good: string;
    easy: string;
    showAnswer: string;
    reviewComplete: string;
    wordsReviewed: (n: number) => string;
  };
  practice: {
    title: string;
    subtitle: string;
    startQuiz: string;
    noWordsTitle: string;
    noWordsDescription: string;
    score: (correct: number, total: number) => string;
    next: string;
    finish: string;
    tryAgain: string;
  };
  import: {
    title: string;
    subtitle: string;
    urlTab: string;
    pasteTab: string;
    fileTab: string;
    urlPlaceholder: string;
    pastePlaceholder: string;
    importButton: string;
    importing: string;
    recentImports: string;
    noImports: string;
  };
  stats: {
    title: string;
    subtitle: string;
    streak: string;
    todayReading: string;
    wordsLearned: string;
    dailyGoal: string;
    thisWeek: string;
    minutes: string;
    goalProgress: (pct: number) => string;
  };
  messages: {
    title: string;
    subtitle: string;
    newMessage: string;
    searchPlaceholder: string;
    noConversations: string;
    typeMessage: string;
    send: string;
  };
  notifications: {
    title: string;
    subtitle: string;
    markAllRead: string;
    empty: string;
    emptyDescription: string;
  };
  search: {
    placeholder: string;
    librarySection: string;
    vocabularySection: string;
    noResults: string;
    shortcut: string;
  };
  documentTitles: {
    signIn: string;
    register: string;
    forgotPassword: string;
    resetPassword: string;
    verifyEmail: string;
    messages: string;
    vocabulary: string;
    practice: string;
    import: string;
    statistics: string;
    notifications: string;
    settings: string;
    reader: string;
    library: string;
    default: string;
  };
}

const EN: LearnerCopy = {
  nav: {
    library: 'Library',
    vocabulary: 'Vocabulary',
    practice: 'Practice',
    import: 'Import',
    statistics: 'Statistics',
    notifications: 'Notifications',
    messages: 'Messages',
    settings: 'Settings',
  },
  shell: {
    tagline: 'Language Learning',
    payAsYouGo: 'Pay as you go',
    payAsYouGoHint: 'Import books · Pay per file',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    notificationsAria: 'Notifications',
    accountMenuAria: 'Account menu',
    logOut: 'Log out',
    language: 'Language',
  },
  common: {
    saveChanges: 'Save changes',
    saving: 'Saving…',
    back: 'Back',
    continue: 'Continue',
    cancel: 'Cancel',
    or: 'or',
    loading: 'Loading…',
    seeAll: 'See all',
    primary: 'Primary',
    verified: 'Verified',
    search: 'Search',
    noResults: 'No results',
    words: (count) => (count >= 1000 ? `${(count / 1000).toFixed(1)}k words` : `${count} ${pluralEn(count, 'word', 'words')}`),
    level: (cefr) => `Level: ${cefr.toUpperCase()}`,
    score: (n) => `Score: ${n}/100`,
  },
  auth: {
    welcomeBack: 'Welcome back',
    createAccount: 'Create your account',
    whatToLearn: 'What do you want to learn?',
    signInSubtitle: 'Sign in to continue your reading journey.',
    signInAdminSubtitle: 'Sign in with your admin account to open the admin console.',
    signUpSubtitle: 'Sign up to start your reading journey.',
    languageStepSubtitle: 'Search and add the language you want to learn. You can add more later in Settings.',
    payPerImportBadge: 'No subscription — pay per import via Atmos',
    freeForeverBadge: 'Free forever plan',
    fullName: 'Full name',
    email: 'Email',
    password: 'Password',
    passwordPlaceholderLogin: 'Your password',
    passwordPlaceholderRegister: 'At least 8 characters',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    continuing: 'Continuing…',
    signUpFree: 'Sign up free',
    createFreeAccount: 'Create free account',
    creatingAccount: 'Creating account…',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    backToHomepage: 'Back to homepage',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    nativeLanguage: 'Your native language',
    nativeLanguagePlaceholder: 'Search your native language...',
    targetLanguages: 'Languages you want to learn',
    targetLanguagesHint: '(search and add at least one)',
    targetLanguagesPlaceholder: 'Search a language to add...',
    legalPrefix: "By continuing, you agree to GOTCHA's",
    termsOfUse: 'Terms of Use',
    legalAnd: 'and',
    privacyPolicy: 'Privacy Policy',
    legalSuffix: '.',
    readYourWay: 'Read your way',
    readYourWayBold: 'to fluency.',
    authTagline: 'The reading-first language app that makes every page a lesson.',
    authFeatures: [
      { title: 'Read real content', desc: 'Books, articles, and news in the languages you want to learn' },
      { title: 'Build vocabulary', desc: 'AI-powered word lookup with spaced repetition' },
      { title: 'Track your progress', desc: 'CEFR level tracking, streaks, and reading stats' },
      { title: 'Learn in context', desc: 'Words stick when you learn them from real sentences' },
    ],
    learnersCount: (n) => `${n} ${pluralEn(Number(String(n).replace(/\D/g, '')), 'learner', 'learners')}`,
    alreadyReading: 'already reading on GOTCHA',
    booksInLanguages: (langs) => `Books, articles, news in ${langs}`,
  },
  authToasts: {
    fillAllFields: 'Please fill in all fields',
    passwordMinLength: 'Password must be at least 8 characters',
    pickNativeLanguage: 'Pick your native language',
    pickTargetLanguage: 'Pick at least one language to learn',
    welcomeBack: 'Welcome back!',
    signedInLearner: 'Signed in to the learner app',
    noAdminAccess: 'This account does not have admin access',
    checkInbox: 'Check your inbox to verify your email',
    accountCreated: 'Account created!',
    verifyBeforeSignIn: 'Please verify your email before signing in',
    accountExistsUnverified: 'Account already exists — check your inbox or resend verification',
    accountExistsSignIn: 'Account already exists — sign in instead',
    authFailed: 'Authentication failed',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Manage your account and learning preferences.',
    account: 'Account',
    photo: 'Photo',
    photoHint: 'Used on Home, Profile, and chat. JPG, PNG, or WebP up to 2 MB.',
    changePhoto: 'Change photo',
    uploading: 'Uploading…',
    photoUpdated: 'Photo updated',
    uploadFailed: 'Upload failed',
    displayName: 'Display name',
    displayNameHint: 'Shown on your profile and leaderboard',
    displayNamePlaceholder: 'Your name',
    nativeLanguage: 'Native language',
    nativeLanguageHint: 'Used for translations and lookups',
    appLanguage: 'App language',
    appLanguageHint: 'Interface language on web and mobile. Same account value.',
    email: 'Email',
    emailHint: 'Used for login and notifications',
    password: 'Password',
    changePassword: 'Change password',
    targetLanguages: 'Target Languages',
    noTargetLanguages: 'No target languages set yet.',
    nativeCannotBeTarget: 'Your native language cannot be a target. Save settings or add a language to learn.',
    addLanguage: 'Add language',
    editTargetLanguage: 'Edit target language',
    addTargetLanguage: 'Add target language',
    languageLabel: 'Language',
    cefrLevel: 'CEFR level',
    setPrimary: 'Set as primary target language',
    saveLanguage: 'Save changes',
    readingPreferences: 'Reading Preferences',
    preview: 'Preview',
    fontSize: 'Font size',
    fontSizeHint: (pct) => `${pct}% — base size`,
    lineSpacing: 'Line spacing',
    lineSpacingHint: (n) => `${n}× line height`,
    readerTheme: 'Reader theme',
    themeLight: 'Light',
    themeSepia: 'Sepia',
    themeDark: 'Dark',
    showKnownWords: 'Show known words',
    showKnownWordsHint: 'When off, known words show without any highlight',
    tts: 'Text-to-speech',
    ttsHint: 'Read text aloud while you follow along',
    learningGoals: 'Learning Goals',
    emailNotifications: 'Email notifications',
    emailNotificationsHint: 'Get an email for new messages, plus reminders before your streak breaks',
    usageImports: 'Usage & Imports',
    loadingUsage: 'Loading usage…',
    freeAllowance: 'Free allowance',
    payPerImport: 'Pay per import',
    importMoreContent: 'Import more content',
    aiLookupsToday: 'AI lookups today',
    freeImportsToday: 'Free imports today',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    saved: 'Settings saved',
    saveFailed: 'Save failed',
    fillPasswordFields: 'Fill in both password fields',
    newPasswordMinLength: 'New password must be at least 8 characters',
    passwordsMismatch: 'Passwords do not match',
    passwordUpdated: 'Password updated. Please sign in again.',
    passwordChangeFailed: 'Could not change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    updatePassword: 'Update password',
    targetSameAsNative: 'Target language cannot be the same as your native language',
    languageAdded: 'Language added',
    languageUpdated: 'Language updated',
    languageSaveFailed: 'Could not save language',
    keepOneTarget: 'You must keep at least one target language',
    languageRemoved: 'Language removed',
    languageRemoveFailed: 'Could not remove language',
    removeLanguage: 'Remove language',
    aiLookupsLine: (used, quota) => `AI lookups: ${used}/${quota} today`,
    freeImportsLine: (remaining, total) => `${remaining} of ${total} free imports left today`,
    freePagesLine: (remaining, total, cycle) => `${remaining} of ${total} free pages left ${cycle}`,
    publicLibraryAccess: 'Access to the public library',
    importLimitLine: (limit) => `Up to ${limit} free imports per day`,
  },
  library: {
    title: 'Library',
    browse: 'Browse',
    continueReading: 'Continue reading',
    recommended: 'Recommended for you',
    allContent: 'All content',
    searchPlaceholder: 'Search library…',
    filterAll: 'All',
    filterFiction: 'Fiction',
    filterNews: 'News',
    filterImports: 'Imports',
    filterA1A2: 'A1–A2',
    filterB1B2: 'B1–B2',
    filterC1C2: 'C1–C2',
    emptyTitle: 'Nothing here yet',
    emptyDescription: 'Browse the catalog or import your own content to start reading.',
    importAction: 'Import content',
    gridView: 'Grid view',
    listView: 'List view',
    backToLibrary: 'Back to library',
    noResults: 'No matching content',
    startReading: 'Start reading',
    resumeReading: 'Resume',
  },
  vocabulary: {
    title: 'Vocabulary',
    subtitle: 'Review words you saved while reading.',
    dueForReview: 'Due for review',
    allWords: 'All words',
    mastered: 'Mastered',
    learning: 'Learning',
    noWordsTitle: 'No words yet',
    noWordsDescription: 'Tap words while reading to build your vocabulary.',
    startReading: 'Go to library',
    again: 'Again',
    hard: 'Hard',
    good: 'Good',
    easy: 'Easy',
    showAnswer: 'Show answer',
    reviewComplete: 'Review complete!',
    wordsReviewed: (n) => `${n} ${pluralEn(n, 'word', 'words')} reviewed`,
  },
  practice: {
    title: 'Practice',
    subtitle: 'Test yourself on words from your vocabulary.',
    startQuiz: 'Start quiz',
    noWordsTitle: 'Not enough words',
    noWordsDescription: 'Save more words while reading to practice.',
    score: (correct, total) => `${correct}/${total} correct`,
    next: 'Next',
    finish: 'Finish',
    tryAgain: 'Try again',
  },
  import: {
    title: 'Import',
    subtitle: 'Bring your own books, articles, and documents.',
    urlTab: 'URL',
    pasteTab: 'Paste text',
    fileTab: 'Upload file',
    urlPlaceholder: 'Paste a web article URL…',
    pastePlaceholder: 'Paste text here…',
    importButton: 'Import',
    importing: 'Importing…',
    recentImports: 'Recent imports',
    noImports: 'No imports yet',
  },
  stats: {
    title: 'Statistics',
    subtitle: 'Track your reading streaks and progress.',
    streak: 'Day streak',
    todayReading: 'Reading today',
    wordsLearned: 'Words learned',
    dailyGoal: 'Daily goal',
    thisWeek: 'This week',
    minutes: 'minutes',
    goalProgress: (pct) => `${pct}% of your daily goal achieved`,
  },
  messages: {
    title: 'Messages',
    subtitle: 'Chat with other learners.',
    newMessage: 'New message',
    searchPlaceholder: 'Search conversations…',
    noConversations: 'No conversations yet',
    typeMessage: 'Type a message…',
    send: 'Send',
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'Stay on top of your learning activity.',
    markAllRead: 'Mark all as read',
    empty: 'No notifications',
    emptyDescription: "You're all caught up.",
  },
  search: {
    placeholder: 'Search library & vocabulary…',
    librarySection: 'Library',
    vocabularySection: 'Vocabulary',
    noResults: 'No results found',
    shortcut: '⌘K',
  },
  documentTitles: {
    signIn: 'Sign in — GOTCHA',
    register: 'Create account — GOTCHA',
    forgotPassword: 'Forgot password — GOTCHA',
    resetPassword: 'Reset password — GOTCHA',
    verifyEmail: 'Verify email — GOTCHA',
    messages: 'Messages — GOTCHA',
    vocabulary: 'Vocabulary — GOTCHA',
    practice: 'Practice — GOTCHA',
    import: 'Import — GOTCHA',
    statistics: 'Statistics — GOTCHA',
    notifications: 'Notifications — GOTCHA',
    settings: 'Settings — GOTCHA',
    reader: 'Reader — GOTCHA',
    library: 'Library — GOTCHA',
    default: 'GOTCHA — Learn by reading',
  },
};

const RU: LearnerCopy = {
  ...EN,
  nav: {
    library: 'Библиотека',
    vocabulary: 'Словарь',
    practice: 'Практика',
    import: 'Импорт',
    statistics: 'Статистика',
    notifications: 'Уведомления',
    messages: 'Сообщения',
    settings: 'Настройки',
  },
  shell: {
    tagline: 'Изучение языков',
    payAsYouGo: 'Оплата по факту',
    payAsYouGoHint: 'Импорт книг · Платите за файл',
    collapseSidebar: 'Свернуть боковую панель',
    expandSidebar: 'Развернуть боковую панель',
    notificationsAria: 'Уведомления',
    accountMenuAria: 'Меню аккаунта',
    logOut: 'Выйти',
    language: 'Язык',
  },
  common: {
    ...EN.common,
    saveChanges: 'Сохранить',
    saving: 'Сохранение…',
    back: 'Назад',
    continue: 'Продолжить',
    cancel: 'Отмена',
    or: 'или',
    loading: 'Загрузка…',
    seeAll: 'Смотреть все',
    primary: 'Основной',
    verified: 'Подтверждён',
    search: 'Поиск',
    noResults: 'Ничего не найдено',
    words: (count) => (count >= 1000 ? `${(count / 1000).toFixed(1)}k слов` : `${count} ${pluralRu(count, 'слово', 'слова', 'слов')}`),
    level: (cefr) => `Уровень: ${cefr.toUpperCase()}`,
    score: (n) => `Балл: ${n}/100`,
  },
  auth: {
    ...EN.auth,
    welcomeBack: 'С возвращением',
    createAccount: 'Создайте аккаунт',
    whatToLearn: 'Какой язык хотите изучать?',
    signInSubtitle: 'Войдите, чтобы продолжить чтение.',
    signInAdminSubtitle: 'Войдите с админ-аккаунтом для доступа к консоли.',
    signUpSubtitle: 'Зарегистрируйтесь, чтобы начать читать.',
    languageStepSubtitle: 'Найдите и добавьте язык. Больше можно добавить в Настройках.',
    payPerImportBadge: 'Без подписки — оплата за импорт через Atmos',
    freeForeverBadge: 'Бесплатный тариф',
    fullName: 'Полное имя',
    email: 'Email',
    password: 'Пароль',
    passwordPlaceholderLogin: 'Ваш пароль',
    passwordPlaceholderRegister: 'Минимум 8 символов',
    forgotPassword: 'Забыли пароль?',
    signIn: 'Войти',
    signingIn: 'Вход…',
    continuing: 'Продолжение…',
    signUpFree: 'Регистрация',
    createFreeAccount: 'Создать бесплатный аккаунт',
    creatingAccount: 'Создание аккаунта…',
    noAccount: 'Нет аккаунта?',
    hasAccount: 'Уже есть аккаунт?',
    backToHomepage: 'На главную',
    hidePassword: 'Скрыть пароль',
    showPassword: 'Показать пароль',
    nativeLanguage: 'Ваш родной язык',
    nativeLanguagePlaceholder: 'Поиск родного языка...',
    targetLanguages: 'Языки для изучения',
    targetLanguagesHint: '(найдите и добавьте хотя бы один)',
    targetLanguagesPlaceholder: 'Поиск языка...',
    legalPrefix: 'Продолжая, вы соглашаетесь с',
    termsOfUse: 'Условиями использования',
    legalAnd: 'и',
    privacyPolicy: 'Политикой конфиденциальности',
    legalSuffix: ' GOTCHA.',
    readYourWay: 'Читайте',
    readYourWayBold: 'к свободному языку.',
    authTagline: 'Приложение для изучения языка через чтение.',
    authFeatures: [
      { title: 'Настоящие тексты', desc: 'Книги, статьи и новости на изучаемых языках' },
      { title: 'Словарь', desc: 'ИИ-перевод и интервальное повторение' },
      { title: 'Прогресс', desc: 'Уровень CEFR, серии и статистика чтения' },
      { title: 'В контексте', desc: 'Слова запоминаются из реальных предложений' },
    ],
    learnersCount: (n) => `${n} ${pluralRu(Number(String(n).replace(/\D/g, '')), 'ученик', 'ученика', 'учеников')}`,
    alreadyReading: 'уже читают в GOTCHA',
    booksInLanguages: (langs) => `Книги, статьи, новости на ${langs}`,
  },
  authToasts: {
    fillAllFields: 'Заполните все поля',
    passwordMinLength: 'Пароль должен быть не менее 8 символов',
    pickNativeLanguage: 'Выберите родной язык',
    pickTargetLanguage: 'Выберите хотя бы один язык для изучения',
    welcomeBack: 'С возвращением!',
    signedInLearner: 'Вы вошли в приложение',
    noAdminAccess: 'У этого аккаунта нет доступа к админке',
    checkInbox: 'Проверьте почту для подтверждения email',
    accountCreated: 'Аккаунт создан!',
    verifyBeforeSignIn: 'Подтвердите email перед входом',
    accountExistsUnverified: 'Аккаунт уже есть — проверьте почту или отправьте письмо повторно',
    accountExistsSignIn: 'Аккаунт уже существует — войдите',
    authFailed: 'Ошибка авторизации',
  },
  settings: {
    ...EN.settings,
    title: 'Настройки',
    subtitle: 'Управление аккаунтом и параметрами обучения.',
    account: 'Аккаунт',
    photo: 'Фото',
    photoHint: 'Для профиля и чата. JPG, PNG или WebP до 2 МБ.',
    changePhoto: 'Сменить фото',
    uploading: 'Загрузка…',
    photoUpdated: 'Фото обновлено',
    uploadFailed: 'Ошибка загрузки',
    displayName: 'Имя',
    displayNameHint: 'Отображается в профиле и рейтинге',
    displayNamePlaceholder: 'Ваше имя',
    nativeLanguage: 'Родной язык',
    nativeLanguageHint: 'Для переводов и поиска слов',
    appLanguage: 'Язык приложения',
    appLanguageHint: 'Язык интерфейса на веб и в приложении.',
    email: 'Email',
    emailHint: 'Для входа и уведомлений',
    password: 'Пароль',
    changePassword: 'Сменить пароль',
    targetLanguages: 'Языки для изучения',
    noTargetLanguages: 'Языки для изучения не заданы.',
    nativeCannotBeTarget: 'Родной язык не может быть целевым. Сохраните настройки или добавьте язык.',
    addLanguage: 'Добавить язык',
    editTargetLanguage: 'Изменить язык',
    addTargetLanguage: 'Добавить язык',
    languageLabel: 'Язык',
    cefrLevel: 'Уровень CEFR',
    setPrimary: 'Сделать основным',
    saveLanguage: 'Сохранить',
    readingPreferences: 'Настройки чтения',
    preview: 'Предпросмотр',
    fontSize: 'Размер шрифта',
    fontSizeHint: (pct) => `${pct}% — базовый размер`,
    lineSpacing: 'Межстрочный интервал',
    lineSpacingHint: (n) => `${n}× высота строки`,
    readerTheme: 'Тема читалки',
    themeLight: 'Светлая',
    themeSepia: 'Сепия',
    themeDark: 'Тёмная',
    showKnownWords: 'Показывать известные слова',
    showKnownWordsHint: 'Если выкл., известные слова без подсветки',
    tts: 'Озвучка',
    ttsHint: 'Читать текст вслух',
    learningGoals: 'Цели обучения',
    emailNotifications: 'Email-уведомления',
    emailNotificationsHint: 'Письма о сообщениях и напоминания о серии',
    usageImports: 'Использование и импорт',
    loadingUsage: 'Загрузка…',
    freeAllowance: 'Бесплатный лимит',
    payPerImport: 'Оплата за импорт',
    importMoreContent: 'Импортировать ещё',
    aiLookupsToday: 'ИИ-запросы сегодня',
    freeImportsToday: 'Бесплатные импорты сегодня',
    signedInAs: 'Вы вошли как',
    signOut: 'Выйти',
    saved: 'Настройки сохранены',
    saveFailed: 'Ошибка сохранения',
    fillPasswordFields: 'Заполните оба поля пароля',
    newPasswordMinLength: 'Новый пароль — минимум 8 символов',
    passwordsMismatch: 'Пароли не совпадают',
    passwordUpdated: 'Пароль обновлён. Войдите снова.',
    passwordChangeFailed: 'Не удалось сменить пароль',
    currentPassword: 'Текущий пароль',
    newPassword: 'Новый пароль',
    confirmPassword: 'Подтвердите пароль',
    updatePassword: 'Обновить пароль',
    targetSameAsNative: 'Целевой язык не может совпадать с родным',
    languageAdded: 'Язык добавлен',
    languageUpdated: 'Язык обновлён',
    languageSaveFailed: 'Не удалось сохранить язык',
    keepOneTarget: 'Нужен хотя бы один целевой язык',
    languageRemoved: 'Язык удалён',
    languageRemoveFailed: 'Не удалось удалить язык',
    removeLanguage: 'Удалить язык',
    aiLookupsLine: (used, quota) => `ИИ-запросы: ${used}/${quota} сегодня`,
    freeImportsLine: (remaining, total) => `${remaining} из ${total} бесплатных импортов сегодня`,
    freePagesLine: (remaining, total, cycle) => `${remaining} из ${total} бесплатных страниц ${cycle}`,
    publicLibraryAccess: 'Доступ к публичной библиотеке',
    importLimitLine: (limit) => `До ${limit} бесплатных импортов в день`,
  },
  library: {
    title: 'Библиотека',
    browse: 'Обзор',
    continueReading: 'Продолжить чтение',
    recommended: 'Рекомендуем',
    allContent: 'Весь контент',
    searchPlaceholder: 'Поиск в библиотеке…',
    filterAll: 'Все',
    filterFiction: 'Художественное',
    filterNews: 'Новости',
    filterImports: 'Импорт',
    filterA1A2: 'A1–A2',
    filterB1B2: 'B1–B2',
    filterC1C2: 'C1–C2',
    emptyTitle: 'Пока пусто',
    emptyDescription: 'Откройте каталог или импортируйте свой контент.',
    importAction: 'Импортировать',
    gridView: 'Сетка',
    listView: 'Список',
    backToLibrary: 'В библиотеку',
    noResults: 'Ничего не найдено',
    startReading: 'Начать чтение',
    resumeReading: 'Продолжить',
  },
  vocabulary: {
    title: 'Словарь',
    subtitle: 'Повторяйте слова, сохранённые при чтении.',
    dueForReview: 'К повторению',
    allWords: 'Все слова',
    mastered: 'Выучено',
    learning: 'Изучаю',
    noWordsTitle: 'Слов пока нет',
    noWordsDescription: 'Нажимайте на слова при чтении, чтобы пополнять словарь.',
    startReading: 'В библиотеку',
    again: 'Снова',
    hard: 'Сложно',
    good: 'Хорошо',
    easy: 'Легко',
    showAnswer: 'Показать ответ',
    reviewComplete: 'Повторение завершено!',
    wordsReviewed: (n) => `${n} ${pluralRu(n, 'слово повторено', 'слова повторено', 'слов повторено')}`,
  },
  practice: {
    title: 'Практика',
    subtitle: 'Проверьте знание слов из словаря.',
    startQuiz: 'Начать тест',
    noWordsTitle: 'Недостаточно слов',
    noWordsDescription: 'Сохраняйте больше слов при чтении.',
    score: (correct, total) => `${correct}/${total} верно`,
    next: 'Далее',
    finish: 'Завершить',
    tryAgain: 'Ещё раз',
  },
  import: {
    title: 'Импорт',
    subtitle: 'Загрузите свои книги, статьи и документы.',
    urlTab: 'URL',
    pasteTab: 'Текст',
    fileTab: 'Файл',
    urlPlaceholder: 'Вставьте URL статьи…',
    pastePlaceholder: 'Вставьте текст…',
    importButton: 'Импорт',
    importing: 'Импорт…',
    recentImports: 'Недавние импорты',
    noImports: 'Импортов пока нет',
  },
  stats: {
    title: 'Статистика',
    subtitle: 'Серии чтения и прогресс.',
    streak: 'Серия дней',
    todayReading: 'Чтение сегодня',
    wordsLearned: 'Слов выучено',
    dailyGoal: 'Дневная цель',
    thisWeek: 'Эта неделя',
    minutes: 'минут',
    goalProgress: (pct) => `${pct}% дневной цели`,
  },
  messages: {
    title: 'Сообщения',
    subtitle: 'Общайтесь с другими учениками.',
    newMessage: 'Новое сообщение',
    searchPlaceholder: 'Поиск диалогов…',
    noConversations: 'Диалогов пока нет',
    typeMessage: 'Введите сообщение…',
    send: 'Отправить',
  },
  notifications: {
    title: 'Уведомления',
    subtitle: 'Активность и напоминания.',
    markAllRead: 'Прочитать все',
    empty: 'Нет уведомлений',
    emptyDescription: 'Вы всё просмотрели.',
  },
  search: {
    placeholder: 'Поиск в библиотеке и словаре…',
    librarySection: 'Библиотека',
    vocabularySection: 'Словарь',
    noResults: 'Ничего не найдено',
    shortcut: '⌘K',
  },
  documentTitles: {
    signIn: 'Вход — GOTCHA',
    register: 'Регистрация — GOTCHA',
    forgotPassword: 'Забыли пароль — GOTCHA',
    resetPassword: 'Сброс пароля — GOTCHA',
    verifyEmail: 'Подтверждение email — GOTCHA',
    messages: 'Сообщения — GOTCHA',
    vocabulary: 'Словарь — GOTCHA',
    practice: 'Практика — GOTCHA',
    import: 'Импорт — GOTCHA',
    statistics: 'Статистика — GOTCHA',
    notifications: 'Уведомления — GOTCHA',
    settings: 'Настройки — GOTCHA',
    reader: 'Читалка — GOTCHA',
    library: 'Библиотека — GOTCHA',
    default: 'GOTCHA — Учитесь через чтение',
  },
};

const UZ: LearnerCopy = {
  ...EN,
  nav: {
    library: 'Kutubxona',
    vocabulary: 'Lugʻat',
    practice: 'Mashq',
    import: 'Import',
    statistics: 'Statistika',
    notifications: 'Bildirishnomalar',
    messages: 'Xabarlar',
    settings: 'Sozlamalar',
  },
  shell: {
    tagline: 'Til oʻrganish',
    payAsYouGo: 'Foydalanganda toʻlash',
    payAsYouGoHint: 'Kitob import · Fayl uchun toʻlov',
    collapseSidebar: 'Yon panelni yigʻish',
    expandSidebar: 'Yon panelni ochish',
    notificationsAria: 'Bildirishnomalar',
    accountMenuAria: 'Hisob menyusi',
    logOut: 'Chiqish',
    language: 'Til',
  },
  common: {
    ...EN.common,
    saveChanges: 'Saqlash',
    saving: 'Saqlanmoqda…',
    back: 'Orqaga',
    continue: 'Davom etish',
    cancel: 'Bekor qilish',
    or: 'yoki',
    loading: 'Yuklanmoqda…',
    seeAll: 'Hammasini koʻrish',
    primary: 'Asosiy',
    verified: 'Tasdiqlangan',
    search: 'Qidirish',
    noResults: 'Natija topilmadi',
    words: (count) => (count >= 1000 ? `${(count / 1000).toFixed(1)}k soʻz` : `${count} soʻz`),
    level: (cefr) => `Daraja: ${cefr.toUpperCase()}`,
    score: (n) => `Ball: ${n}/100`,
  },
  auth: {
    ...EN.auth,
    welcomeBack: 'Xush kelibsiz',
    createAccount: 'Hisob yarating',
    whatToLearn: 'Qaysi tilni oʻrganmoqchisiz?',
    signInSubtitle: 'Oʻqishni davom ettirish uchun kiring.',
    signInAdminSubtitle: 'Admin konsoliga kirish uchun admin hisobingiz bilan kiring.',
    signUpSubtitle: 'Oʻqishni boshlash uchun roʻyxatdan oʻting.',
    languageStepSubtitle: 'Tilni qidiring va qoʻshing. Sozlamalarda yana qoʻshishingiz mumkin.',
    payPerImportBadge: 'Obuna yoʻq — Atmos orqali import uchun toʻlov',
    freeForeverBadge: 'Doimiy bepul reja',
    fullName: 'Toʻliq ism',
    email: 'Email',
    password: 'Parol',
    passwordPlaceholderLogin: 'Parolingiz',
    passwordPlaceholderRegister: 'Kamida 8 belgi',
    forgotPassword: 'Parolni unutdingizmi?',
    signIn: 'Kirish',
    signingIn: 'Kirish…',
    continuing: 'Davom etish…',
    signUpFree: 'Bepul roʻyxatdan oʻtish',
    createFreeAccount: 'Bepul hisob yaratish',
    creatingAccount: 'Hisob yaratilmoqda…',
    noAccount: 'Hisobingiz yoʻqmi?',
    hasAccount: 'Allaqachon hisobingiz bormi?',
    backToHomepage: 'Bosh sahifaga',
    hidePassword: 'Parolni yashirish',
    showPassword: 'Parolni koʻrsatish',
    nativeLanguage: 'Ona tilingiz',
    nativeLanguagePlaceholder: 'Ona tilini qidiring...',
    targetLanguages: 'Oʻrganmoqchi boʻlgan tillar',
    targetLanguagesHint: '(kamida bittasini qidiring va qoʻshing)',
    targetLanguagesPlaceholder: 'Til qidiring...',
    legalPrefix: 'Davom etish orqali GOTCHA',
    termsOfUse: 'Foydalanish shartlari',
    legalAnd: 'va',
    privacyPolicy: 'Maxfiylik siyosati',
    legalSuffix: 'ga rozilik bildirasiz.',
    readYourWay: 'Oʻqib',
    readYourWayBold: 'erkin gapiring.',
    authTagline: 'Har bir sahifa dars boʻladigan oʻqishga asoslangan til ilovasi.',
    authFeatures: [
      { title: 'Haqiqiy kontent', desc: 'Oʻrganmoqchi boʻlgan tillarda kitoblar, maqolalar va yangiliklar' },
      { title: 'Lugʻat', desc: 'Sun’iy intellekt tarjimasi va interval takrorlash' },
      { title: 'Progress', desc: 'CEFR darajasi, seriyalar va oʻqish statistikasi' },
      { title: 'Kontekstda', desc: 'Soʻzlar haqiqiy jumlalardan yodlanadi' },
    ],
    learnersCount: (n) => `${n} oʻquvchi`,
    alreadyReading: 'GOTCHA’da oʻqimoqda',
    booksInLanguages: (langs) => `${langs} tillarda kitoblar, maqolalar, yangiliklar`,
  },
  authToasts: {
    fillAllFields: 'Barcha maydonlarni toʻldiring',
    passwordMinLength: 'Parol kamida 8 belgidan iborat boʻlishi kerak',
    pickNativeLanguage: 'Ona tilini tanlang',
    pickTargetLanguage: 'Kamida bitta til tanlang',
    welcomeBack: 'Xush kelibsiz!',
    signedInLearner: 'Oʻquvchi ilovasiga kirdingiz',
    noAdminAccess: 'Bu hisobda admin huquqi yoʻq',
    checkInbox: 'Emailni tasdiqlash uchun pochtangizni tekshiring',
    accountCreated: 'Hisob yaratildi!',
    verifyBeforeSignIn: 'Kirishdan oldin emailni tasdiqlang',
    accountExistsUnverified: 'Hisob mavjud — pochtani tekshiring yoki qayta yuboring',
    accountExistsSignIn: 'Hisob mavjud — kiring',
    authFailed: 'Autentifikatsiya xatosi',
  },
  settings: {
    ...EN.settings,
    title: 'Sozlamalar',
    subtitle: 'Hisob va oʻqish sozlamalarini boshqaring.',
    account: 'Hisob',
    photo: 'Rasm',
    photoHint: 'Profil va chat uchun. JPG, PNG yoki WebP, 2 MB gacha.',
    changePhoto: 'Rasmni almashtirish',
    uploading: 'Yuklanmoqda…',
    photoUpdated: 'Rasm yangilandi',
    uploadFailed: 'Yuklash xatosi',
    displayName: 'Koʻrinadigan ism',
    displayNameHint: 'Profil va reytingda koʻrinadi',
    displayNamePlaceholder: 'Ismingiz',
    nativeLanguage: 'Ona tili',
    nativeLanguageHint: 'Tarjima va soʻz qidirish uchun',
    appLanguage: 'Ilova tili',
    appLanguageHint: 'Veb va mobil interfeys tili. Bir xil sozlama.',
    email: 'Email',
    emailHint: 'Kirish va bildirishnomalar uchun',
    password: 'Parol',
    changePassword: 'Parolni oʻzgartirish',
    targetLanguages: 'Oʻrganiladigan tillar',
    noTargetLanguages: 'Hali til qoʻshilmagan.',
    nativeCannotBeTarget: 'Ona til maqsad til boʻla olmaydi. Sozlamalarni saqlang yoki til qoʻshing.',
    addLanguage: 'Til qoʻshish',
    editTargetLanguage: 'Tilni tahrirlash',
    addTargetLanguage: 'Til qoʻshish',
    languageLabel: 'Til',
    cefrLevel: 'CEFR darajasi',
    setPrimary: 'Asosiy til sifatida belgilash',
    saveLanguage: 'Saqlash',
    readingPreferences: 'Oʻqish sozlamalari',
    preview: 'Koʻrib chiqish',
    fontSize: 'Shrift oʻlchami',
    fontSizeHint: (pct) => `${pct}% — asosiy oʻlcham`,
    lineSpacing: 'Qator oraligʻi',
    lineSpacingHint: (n) => `${n}× qator balandligi`,
    readerTheme: 'Oʻqish mavzusi',
    themeLight: 'Yorugʻ',
    themeSepia: 'Sepia',
    themeDark: 'Qorongʻi',
    showKnownWords: 'Ma’lum soʻzlarni koʻrsatish',
    showKnownWordsHint: 'Oʻchirilsa, ma’lum soʻzlar belgilanmaydi',
    tts: 'Ovozli oʻqish',
    ttsHint: 'Matnni ovozda oʻqish',
    learningGoals: 'Oʻqish maqsadlari',
    emailNotifications: 'Email bildirishnomalar',
    emailNotificationsHint: 'Yangi xabarlar va seriya eslatmalari',
    usageImports: 'Foydalanish va import',
    loadingUsage: 'Yuklanmoqda…',
    freeAllowance: 'Bepul limit',
    payPerImport: 'Import uchun toʻlov',
    importMoreContent: 'Yana import qilish',
    aiLookupsToday: 'Bugungi AI soʻrovlar',
    freeImportsToday: 'Bugungi bepul importlar',
    signedInAs: 'Kirish:',
    signOut: 'Chiqish',
    saved: 'Sozlamalar saqlandi',
    saveFailed: 'Saqlash xatosi',
    fillPasswordFields: 'Ikkala parol maydonini toʻldiring',
    newPasswordMinLength: 'Yangi parol kamida 8 belgi',
    passwordsMismatch: 'Parollar mos kelmadi',
    passwordUpdated: 'Parol yangilandi. Qayta kiring.',
    passwordChangeFailed: 'Parolni oʻzgartirib boʻlmadi',
    currentPassword: 'Joriy parol',
    newPassword: 'Yangi parol',
    confirmPassword: 'Parolni tasdiqlang',
    updatePassword: 'Parolni yangilash',
    targetSameAsNative: 'Maqsad til ona til bilan bir xil boʻla olmaydi',
    languageAdded: 'Til qoʻshildi',
    languageUpdated: 'Til yangilandi',
    languageSaveFailed: 'Tilni saqlab boʻlmadi',
    keepOneTarget: 'Kamida bitta maqsad til kerak',
    languageRemoved: 'Til olib tashlandi',
    languageRemoveFailed: 'Tilni olib boʻlmadi',
    removeLanguage: 'Tilni olib tashlash',
    aiLookupsLine: (used, quota) => `AI soʻrovlar: ${used}/${quota} bugun`,
    freeImportsLine: (remaining, total) => `Bugun ${total} dan ${remaining} bepul import qoldi`,
    freePagesLine: (remaining, total, cycle) => `${cycle} ${total} dan ${remaining} bepul sahifa qoldi`,
    publicLibraryAccess: 'Ommaviy kutubxonaga kirish',
    importLimitLine: (limit) => `Kuniga ${limit} gacha bepul import`,
  },
  library: {
    title: 'Kutubxona',
    browse: 'Koʻrish',
    continueReading: 'Oʻqishni davom ettirish',
    recommended: 'Sizga tavsiya',
    allContent: 'Barcha kontent',
    searchPlaceholder: 'Kutubxonada qidirish…',
    filterAll: 'Hammasi',
    filterFiction: 'Badiiy',
    filterNews: 'Yangiliklar',
    filterImports: 'Import',
    filterA1A2: 'A1–A2',
    filterB1B2: 'B1–B2',
    filterC1C2: 'C1–C2',
    emptyTitle: 'Hali hech narsa yoʻq',
    emptyDescription: 'Katalogni koʻring yoki oʻz kontentingizni import qiling.',
    importAction: 'Import qilish',
    gridView: 'Panjara',
    listView: 'Roʻyxat',
    backToLibrary: 'Kutubxonaga',
    noResults: 'Mos kontent topilmadi',
    startReading: 'Oʻqishni boshlash',
    resumeReading: 'Davom etish',
  },
  vocabulary: {
    title: 'Lugʻat',
    subtitle: 'Oʻqishda saqlangan soʻzlarni takrorlang.',
    dueForReview: 'Takrorlash kerak',
    allWords: 'Barcha soʻzlar',
    mastered: 'Oʻzlashtirilgan',
    learning: 'Oʻrganilmoqda',
    noWordsTitle: 'Hali soʻz yoʻq',
    noWordsDescription: 'Oʻqishda soʻzlarni bosib lugʻatga qoʻshing.',
    startReading: 'Kutubxonaga',
    again: 'Yana',
    hard: 'Qiyin',
    good: 'Yaxshi',
    easy: 'Oson',
    showAnswer: 'Javobni koʻrsatish',
    reviewComplete: 'Takrorlash tugadi!',
    wordsReviewed: (n) => `${n} soʻz takrorlandi`,
  },
  practice: {
    title: 'Mashq',
    subtitle: 'Lugʻatdagi soʻzlarni sinab koʻring.',
    startQuiz: 'Testni boshlash',
    noWordsTitle: 'Soʻzlar yetarli emas',
    noWordsDescription: 'Oʻqishda koʻproq soʻz saqlang.',
    score: (correct, total) => `${correct}/${total} toʻgʻri`,
    next: 'Keyingi',
    finish: 'Tugatish',
    tryAgain: 'Yana urinish',
  },
  import: {
    title: 'Import',
    subtitle: 'Oʻz kitob, maqola va hujjatlaringizni yuklang.',
    urlTab: 'URL',
    pasteTab: 'Matn',
    fileTab: 'Fayl',
    urlPlaceholder: 'Maqola URL manzilini qoʻying…',
    pastePlaceholder: 'Matnni shu yerga qoʻying…',
    importButton: 'Import',
    importing: 'Import qilinmoqda…',
    recentImports: 'Soʻnggi importlar',
    noImports: 'Hali import yoʻq',
  },
  stats: {
    title: 'Statistika',
    subtitle: 'Oʻqish seriyalari va progress.',
    streak: 'Kunlik seriya',
    todayReading: 'Bugungi oʻqish',
    wordsLearned: 'Oʻrganilgan soʻzlar',
    dailyGoal: 'Kunlik maqsad',
    thisWeek: 'Shu hafta',
    minutes: 'daqiqa',
    goalProgress: (pct) => `Kunlik maqsadning ${pct}%`,
  },
  messages: {
    title: 'Xabarlar',
    subtitle: 'Boshqa oʻquvchilar bilan suhbat.',
    newMessage: 'Yangi xabar',
    searchPlaceholder: 'Suhbatlarni qidirish…',
    noConversations: 'Hali suhbat yoʻq',
    typeMessage: 'Xabar yozing…',
    send: 'Yuborish',
  },
  notifications: {
    title: 'Bildirishnomalar',
    subtitle: 'Oʻqish faoliyati va eslatmalar.',
    markAllRead: 'Hammasini oʻqilgan deb belgilash',
    empty: 'Bildirishnoma yoʻq',
    emptyDescription: 'Hammasi koʻrib chiqilgan.',
  },
  search: {
    placeholder: 'Kutubxona va lugʻatda qidirish…',
    librarySection: 'Kutubxona',
    vocabularySection: 'Lugʻat',
    noResults: 'Natija topilmadi',
    shortcut: '⌘K',
  },
  documentTitles: {
    signIn: 'Kirish — GOTCHA',
    register: 'Roʻyxatdan oʻtish — GOTCHA',
    forgotPassword: 'Parolni tiklash — GOTCHA',
    resetPassword: 'Parolni yangilash — GOTCHA',
    verifyEmail: 'Email tasdiqlash — GOTCHA',
    messages: 'Xabarlar — GOTCHA',
    vocabulary: 'Lugʻat — GOTCHA',
    practice: 'Mashq — GOTCHA',
    import: 'Import — GOTCHA',
    statistics: 'Statistika — GOTCHA',
    notifications: 'Bildirishnomalar — GOTCHA',
    settings: 'Sozlamalar — GOTCHA',
    reader: 'Oʻqish — GOTCHA',
    library: 'Kutubxona — GOTCHA',
    default: 'GOTCHA — Oʻqib til oʻrganing',
  },
};

const COPIES: Record<UiLanguage, LearnerCopy> = { en: EN, ru: RU, uz: UZ };

export function learnerCopyFor(locale: UiLanguage): FullLearnerCopy {
  return { ...COPIES[locale] ?? EN, ...learnerCopyExtFor(locale) };
}
