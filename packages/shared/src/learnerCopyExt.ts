import { pluralEn, pluralRu } from './plural';
/** UI locale codes — keep in sync with UI_LANGUAGES in index.ts */
export type UiLanguage = 'en' | 'ru' | 'uz';

/** Extended UI copy — merged into LearnerCopy at runtime. */
export interface LearnerCopyExt {
  authPages: {
    forgotTitle: string;
    forgotSubtitle: string;
    forgotAdminSubtitle: string;
    sendResetLink: string;
    sending: string;
    checkEmail: string;
    checkEmailBody: string;
    openEmailApp: string;
    resendEmail: string;
    didntReceive: string;
    useDifferentEmail: string;
    enterEmail: string;
    resetLinkSent: string;
    resetLinkResent: string;
    couldNotSendReset: string;
    couldNotResend: string;
    openInboxHint: (email: string) => string;
    verifyTitle: string;
    verifySuccessTitle: string;
    verifyErrorTitle: string;
    verifyingTitle: string;
    verifySuccessBody: string;
    verifySuccessAdminBody: string;
    verifyErrorBody: string;
    verifyingBody: string;
    verifySentBody: string;
    verifySentAdminBody: string;
    confirmEmail: string;
    resendVerification: string;
    alreadyVerified: string;
    verifiedToast: string;
    enterRegisteredEmail: string;
    verificationSent: string;
    openAppTitle: string;
    openAppBody: string;
    openGotchaApp: string;
    continueOnWeb: string;
    resetChooseTitle: string;
    resetChooseSubtitle: string;
    resetConfirmPlaceholder: string;
    resetUpdatedTitle: string;
    resetUpdatedBody: string;
    resetUpdatedAdminBody: string;
    linkInvalidTitle: string;
    linkInvalidBody: string;
    resetLinkMissing: string;
    resetSuccessToast: string;
    couldNotReset: string;
    saving: string;
  };
  reader: {
    dictionary: string;
    lookingUp: string;
    naturalMeaning: string;
    translation: string;
    save: string;
    known: string;
    ignore: string;
    contentNotFound: string;
    contentLoadFailed: string;
    markAsLabel: string;
    tryAgain: string;
    noSegments: string;
    stillProcessing: string;
    chapterOf: (n: number, total: number) => string;
    chapterN: (n: number) => string;
    pageOf: (n: number, total: number) => string;
    backToLibrary: string;
    unknown: string;
    learning: string;
    unknownOnly: string;
    practice: string;
    chapters: string;
    collapse: string;
    page: (n: number) => string;
    content: string;
    trialBanner: (price: string) => string;
    previous: string;
    next: string;
    unlockFullBook: string;
    finish: string;
    readingComplete: string;
    markedAs: (status: string) => string;
    savedToVocab: string;
    lookupError: string;
    pronounceWord: string;
    zoomOut: string;
    zoomIn: string;
    unknownOnlyTitle: string;
    practiceTitle: string;
    goToPage: string;
    keepReadingSample: string;
  };
  libraryPage: {
    goodMorning: string;
    goodAfternoon: string;
    goodEvening: string;
    browseTitle: string;
    streak: string;
    words: string;
    days: (n: number) => string;
    trySample: string;
    newBadge: string;
    percentRead: (n: number) => string;
    percentKnown: (n: number) => string;
    resume: string;
    yourLibraryEmpty: string;
    loadErrorTitle: string;
    loadErrorBody: string;
    noContentFound: string;
    newInLibrary: string;
    yourImports: string;
    continueReading: string;
    recommended: string;
    streakStartToday: (minutes: number) => string;
    streakDayOne: string;
    streakKeepAlive: string;
    newMaterialLabel: string;
    newMaterialHint: string;
    learnerFallback: string;
  };
  importPage: {
    pageTitle: string;
    pageSubtitle: string;
    statusReady: string;
    statusProcessing: string;
    statusQueued: string;
    statusFailed: string;
    language: string;
    titleOptional: string;
    importFromUrl: string;
    importText: string;
    uploadFile: string;
    pastePlaceholder: string;
    wordsNeeded: string;
    onlyPdfEpub: string;
    dropFile: string;
    importHistory: string;
    read: string;
    delete: string;
    previous: string;
    next: string;
    enterCardDetails: string;
    enterSmsCode: string;
    purchaseFor: (amount: string) => string;
    confirmPayment: string;
    resendCode: string;
    importReady: string;
    importLimitReached: string;
    deleteImport: string;
    deleteConfirm: string;
    titleLabel: string;
    textLabel: string;
    titlePlaceholder: string;
    autoFromPage: string;
    autoFromFilename: string;
    urlHelp: string;
    textTooLong: (maxChars: number) => string;
    freeAllowanceCovered: string;
    lengthNotPriced: string;
    allowanceReachedPaid: string;
    allowanceReachedFree: string;
    paidImportsHint: string;
    freeImportsHint: string;
    importRemoved: string;
    pageTier: (label: string) => string;
    estimatedPages: string;
    total: string;
    pagesProgress: (done: number, total: number) => string;
    freeLeftToday: (remaining: number, total: number) => string;
    importsCount: (total: number) => string;
    importsCountLimit: (total: number, limit: number) => string;
  };
  messagesPage: {
    recentChats: string;
    noConversationsHint: string;
    yesterday: string;
    typing: string;
    online: string;
    lastSeen: (time: string) => string;
    selectConversation: string;
    loadingConversation: string;
    chatTip: string;
    reply: string;
    edit: string;
    delete: string;
    messageDeleted: string;
    edited: string;
    translateFailed: string;
    emptyTitle: string;
    emptyBody: string;
    sendFriend: string;
    birthYearBanner: string;
    recipientNotEligible: string;
    you: string;
    wordMeaning: string;
    editingMessage: string;
    replyTo: (name: string) => string;
    deleteForEveryone: string;
    deleteConfirm: string;
    chatTipTitle: string;
    suggestedFromReadings: string;
    learner: string;
  };
  practicePage: {
    practiceWhatYouRead: string;
    goToLibrary: string;
    comprehension: string;
    fillBlank: string;
    shortAnswer: string;
    quizYourself: string;
    generatingQuiz: string;
    typeAnswer: string;
    nextQuestion: string;
    finishQuiz: string;
    submitting: string;
    greatWork: string;
    tryAnother: string;
    backToReading: string;
    openChapterFirst: string;
    pickAnswer: string;
    readerHint: string;
  };
  paywall: {
    unlockBook: string;
    congratulations: string;
    startReading: string;
    failedPayment: string;
    cardVerificationFailed: string;
    unlockFor: (amount: string) => string;
    paymentNotStartedBook: string;
  };
  importReturn: {
    confirming: string;
    waitingAtmos: string;
    missingReference: string;
    paymentConfirmed: string;
    importReady: string;
    reselectFile: string;
    paymentNotConfirmedToast: string;
    importing: string;
    importSubmitted: string;
    couldNotFinishImport: string;
  };
  peerProfile: {
    title: string;
    loading: string;
    message: (name: string) => string;
    memberSince: (date: string) => string;
    booksRead: string;
    wordsLearned: string;
    chats: string;
    languages: string;
    native: string;
    currentlyReading: string;
    percentRead: (n: number) => string;
    proficient: string;
    intermediate: string;
    basic: string;
  };
  languageInput: {
    searchPlaceholder: string;
    addAnother: string;
    noMatch: string;
    remove: (name: string) => string;
  };
  statsPage: {
    last7Days: string;
    last30Days: string;
    currentStreak: string;
    readingTime: string;
    vocabularyBreakdown: string;
    booksRead: string;
    noDataYet: string;
    minutesRead: string;
    wordsAdded: string;
    dailyAverage: string;
  };
  billing: {
    today: string;
    thisMonth: string;
    thisYear: string;
    importsFree: string;
    freeImportsLeft: (remaining: number, total: number, cycle: string) => string;
    freePagesLeft: (remaining: number, total: number, cycle: string) => string;
    configuredPool: (dailyImports: number, pageLimit: number, cycle: string) => string;
  };
  commonExt: {
    delete: string;
    read: string;
    previous: string;
    next: string;
    close: string;
    confirm: string;
    retry: string;
    error: string;
    offline: string;
    tooLong: string;
    success: string;
    new: string;
    days: string;
    minutes: string;
    hours: string;
    yesterday: string;
    today: string;
  };
  vocabPage: {
    pageSubtitle: string;
    loading: string;
    loadErrorTitle: string;
    searchPlaceholder: string;
    total: string;
    due: string;
    mastery: string;
    word: string;
    translation: string;
    status: string;
    next: string;
    interval: string;
    reps: string;
    actions: string;
    dueForReview: string;
    markKnown: string;
    remove: string;
    noMatchSearch: string;
    reviewDue: (count: number) => string;
    wordCountSummary: (total: number, learning: number, mastered: number) => string;
    showingCount: (shown: number, total: number) => string;
    ratedAs: (lemma: string, rating: string) => string;
    filterAll: string;
    filterDue: (count: number) => string;
    filterLearning: string;
    filterKnown: string;
    overdue: (days: number) => string;
    tomorrow: string;
    inDays: (days: number) => string;
    statusLearning: string;
    statusKnown: string;
  };
  notificationsPage: {
    filterAll: (count: number) => string;
    filterUnread: (count: number) => string;
    filterLibrary: (count: number) => string;
    filterSystem: (count: number) => string;
    emptyUnread: string;
    emptyLibrary: string;
    catalogHint: string;
    justNow: string;
    minutesAgo: (mins: number) => string;
    hoursAgo: (hours: number) => string;
    daysAgo: (days: number) => string;
  };
  charts: {
    noActivityInRange: string;
    noWordSavesYet: string;
    noWordsInRange: string;
    noBooksRead: string;
    booksRead: (count: number) => string;
    booksReadFinished: (count: number, finished: number) => string;
  };
  errors: {
    lookupFailed: string;
    saveFailed: string;
    updateFailed: string;
    reviewFailed: string;
    importFailed: string;
    uploadFailed: string;
    registrationFailed: string;
    failedLoadVocab: string;
    requestFailed: string;
    failedStartPayment: string;
    cardVerificationFailed: string;
    unexpectedPaymentState: string;
    paymentNotConfirmedOtp: string;
    paymentNotConfirmedCard: string;
    couldNotResendOtp: string;
    otpVerificationFailed: string;
    couldNotDeleteImport: string;
    pronunciationUnavailable: string;
  };
  timeAgo: {
    justNow: string;
    minutesAgo: (mins: number) => string;
    hoursAgo: (hours: number) => string;
    daysAgo: (days: number) => string;
  };
}

const EXT_EN: LearnerCopyExt = {
  authPages: {
    forgotTitle: 'Reset password',
    forgotSubtitle: "Enter your email and we'll send you a reset link.",
    forgotAdminSubtitle: 'Enter your admin account email and we will send a reset link. After resetting, sign in to return to the admin console.',
    sendResetLink: 'Send Reset Link',
    sending: 'Sending…',
    checkEmail: 'Check your email',
    checkEmailBody: 'If an account exists for that address, we sent a password reset link. It expires in 1 hour.',
    openEmailApp: 'Open Email App',
    resendEmail: 'Resend email',
    didntReceive: "Didn't receive it?",
    useDifferentEmail: 'Use a different email',
    enterEmail: 'Please enter your email',
    resetLinkSent: 'Check your inbox for a reset link',
    resetLinkResent: 'Reset email sent again — check your inbox',
    couldNotSendReset: 'Could not send reset link',
    couldNotResend: 'Could not resend email',
    openInboxHint: (email) => `Open the inbox for ${email || 'your email'} and tap the reset link.`,
    verifyTitle: 'Verify your email',
    verifySuccessTitle: 'Email verified',
    verifyErrorTitle: 'Link expired',
    verifyingTitle: 'Verifying…',
    verifySuccessBody: 'Your email is confirmed. Sign in to start your reading journey.',
    verifySuccessAdminBody: 'Your email is confirmed. Sign in to return to the admin console.',
    verifyErrorBody: 'This verification link is invalid or has expired. Request a new one below.',
    verifyingBody: 'Hang tight while we confirm your email address…',
    verifySentBody: "We've sent a verification link to your email address. Please check your inbox and tap the link to confirm your account.",
    verifySentAdminBody: "We've sent a verification link to your email. Confirm your address, then sign in to return to the admin console.",
    confirmEmail: 'Confirming your email…',
    resendVerification: 'Resend verification email',
    alreadyVerified: 'Already verified?',
    verifiedToast: 'Email verified — you can sign in now',
    enterRegisteredEmail: 'Enter the email you registered with',
    verificationSent: 'Verification email sent — check your inbox',
    openAppTitle: 'Opening GOTCHA app',
    openAppBody: 'Verify your email in the GOTCHA mobile app. If nothing happens, tap Open app below.',
    openGotchaApp: 'Open GOTCHA app',
    continueOnWeb: 'Continue on web instead',
    resetChooseTitle: 'Choose a new password',
    resetChooseSubtitle: 'Enter a new password for your GOTCHA account. Use at least 8 characters.',
    resetConfirmPlaceholder: 'Repeat your new password',
    resetUpdatedTitle: 'Password updated',
    resetUpdatedBody: 'Your password has been changed. Sign in with your new password to continue.',
    resetUpdatedAdminBody: 'Your password has been changed. Sign in with your new password to return to the admin console.',
    linkInvalidTitle: 'Link invalid',
    linkInvalidBody: 'This reset link is missing or incomplete. Request a new one from the forgot password page.',
    resetLinkMissing: 'Reset link is missing or invalid',
    resetSuccessToast: 'Password updated — you can sign in now',
    couldNotReset: 'Could not reset password',
    saving: 'Saving…',
  },
  reader: {
    dictionary: 'Dictionary',
    lookingUp: 'Looking up…',
    naturalMeaning: 'Natural meaning',
    translation: 'Translation',
    save: 'Save',
    known: 'Known',
    ignore: 'Ignore',
    contentNotFound: 'Content not found',
    contentLoadFailed: 'Could not load this book. Check your connection and try again.',
    markAsLabel: '→ Mark as:',
    tryAgain: 'Try again',
    noSegments: 'No content segments available',
    stillProcessing: 'This item may still be processing.',
    chapterOf: (n: number, total: number) => `Chapter ${n} of ${total}`,
    chapterN: (n: number) => `Chapter ${n}`,
    pageOf: (n: number, total: number) => `${n} of ${total}`,
    backToLibrary: 'Library',
    unknown: 'unknown',
    learning: 'learning',
    unknownOnly: 'Unknown only',
    practice: 'Practice',
    chapters: 'Chapters',
    collapse: 'Collapse',
    page: (n) => `Page ${n}`,
    content: 'Content',
    trialBanner: (price) => `Free sample of this book. Unlock the rest for ${price}.`,
    previous: 'Previous',
    next: 'Next',
    unlockFullBook: 'Unlock full book',
    finish: 'Finish',
    readingComplete: 'Reading complete!',
    markedAs: (status) => `marked as ${status}`,
    savedToVocab: 'saved to vocabulary',
    lookupError: 'Could not look up word',
    pronounceWord: 'Pronounce word',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    unknownOnlyTitle: 'Show only unknown-word highlights',
    practiceTitle: 'Quiz yourself on this chapter',
    goToPage: 'Go to page in this chapter',
    keepReadingSample: 'Keep reading the sample',
  },
  libraryPage: {
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    browseTitle: 'Browse Library',
    streak: 'Streak',
    words: 'Words',
    days: (n) => `${n} ${pluralEn(n, 'day', 'days')}`,
    trySample: 'Try sample',
    newBadge: 'New',
    percentRead: (n) => `${n}% read`,
    percentKnown: (n) => `${n}% known`,
    resume: 'Resume',
    yourLibraryEmpty: 'Your library is empty',
    loadErrorTitle: 'Couldn’t load the library',
    loadErrorBody: 'Check your connection and try again.',
    noContentFound: 'No content found',
    newInLibrary: 'New in the library',
    yourImports: 'Your imports',
    continueReading: 'Continue reading',
    recommended: 'Recommended for you',
    streakStartToday: (minutes) => `Read ${minutes} min today to start your streak.`,
    streakDayOne: "You're on day 1 — keep it going tomorrow!",
    streakKeepAlive: "Keep your streak alive — you're on a roll.",
    newMaterialLabel: 'New material',
    newMaterialHint: 'On your library dashboard — open it when you want to read or purchase.',
    learnerFallback: 'Learner',
  },
  importPage: {
    pageTitle: 'Import Content',
    pageSubtitle: 'Add your own texts, articles, and documents to your library.',
    statusReady: 'Ready',
    statusProcessing: 'Processing',
    statusQueued: 'Queued',
    statusFailed: 'Failed',
    language: 'Language',
    titleOptional: 'Title (optional)',
    importFromUrl: 'Import from URL',
    importText: 'Import Text',
    uploadFile: 'Upload File',
    pastePlaceholder: 'Paste your text here…',
    wordsNeeded: 'more words needed',
    onlyPdfEpub: 'Only PDF and EPUB files are supported',
    dropFile: 'Drop a PDF or ePub here',
    importHistory: 'Import History',
    read: 'Read',
    delete: 'Delete',
    previous: 'Previous',
    next: 'Next',
    enterCardDetails: 'Enter Card Details',
    enterSmsCode: 'Enter SMS Code',
    purchaseFor: (amount) => `Purchase for ${amount}`,
    confirmPayment: 'Confirm Payment',
    resendCode: 'Resend Code',
    importReady: 'Import ready to read',
    importLimitReached: 'Import limit reached',
    deleteImport: 'Delete import',
    deleteConfirm: 'Delete this import permanently?',
    titleLabel: 'Title',
    textLabel: 'Text',
    titlePlaceholder: 'My text',
    autoFromPage: 'Auto-detected from page',
    autoFromFilename: 'Auto from filename',
    urlHelp: 'Works with Gutenberg, Wikipedia, public articles, and .txt URLs. Novels are split into printed chapters. Paywalled pages will fail with a clear error.',
    textTooLong: (maxChars) => `Text exceeds the ${maxChars.toLocaleString()}-character maximum. Split into multiple imports.`,
    freeAllowanceCovered: 'Covered by your free import allowance.',
    lengthNotPriced: 'This length is not priced yet. Try a shorter document or try again later.',
    allowanceReachedPaid: 'Import allowance reached. Delete an old import or pay per material size via Atmos.',
    allowanceReachedFree: 'Import allowance reached. Delete an old import to free up space — paid imports are not available right now.',
    paidImportsHint: 'Paid imports are priced by page count in soʻm and paid via Atmos. Your free allowance is used first.',
    freeImportsHint: 'Free plan: 3 imports a day and 50 pages a month. Daily limits reset at 00:00 Tashkent time; pages reset on the 1st.',
    importRemoved: 'Import removed from history',
    pageTier: (label) => `Page tier (${label})`,
    estimatedPages: 'Estimated pages',
    total: 'Total',
    pagesProgress: (done, total) => `${done} / ${total} pages`,
    freeLeftToday: (remaining, total) => `${remaining} free left today · ${total} import${total !== 1 ? 's' : ''}`,
    importsCount: (total) => `${total} import${total !== 1 ? 's' : ''}`,
    importsCountLimit: (total, limit) => `${total} / ${limit} imports`,
  },
  messagesPage: {
    recentChats: 'RECENT CHATS',
    noConversationsHint: 'No conversations yet. Start chatting with other learners!',
    yesterday: 'Yesterday',
    typing: 'typing…',
    online: 'online',
    lastSeen: (time) => `last seen ${time} ago`,
    selectConversation: 'Select a conversation',
    loadingConversation: 'Loading conversation…',
    chatTip: 'Tip: tap any word in a message to look it up.',
    reply: 'Reply',
    edit: 'Edit',
    delete: 'Delete',
    messageDeleted: 'This message was deleted',
    edited: 'edited',
    translateFailed: 'Couldn\'t translate',
    emptyTitle: 'No conversations yet',
    emptyBody: 'Messaging is for friends. Send a friend request to start.',
    sendFriend: 'Send friend request',
    birthYearBanner: 'Add your birth year to send messages',
    recipientNotEligible: "This learner can't receive messages yet.",
    you: 'You',
    wordMeaning: 'Word Meaning',
    editingMessage: 'Editing message',
    replyTo: (name) => `Reply to ${name}`,
    deleteForEveryone: 'Delete this message for everyone?',
    deleteConfirm: 'Delete this message?',
    chatTipTitle: 'Tap a word, or hold and drag a phrase',
    suggestedFromReadings: 'SUGGESTED FROM READINGS',
    learner: 'Learner',
  },
  practicePage: {
    practiceWhatYouRead: 'Practice what you read',
    goToLibrary: 'Go to Library',
    comprehension: 'Comprehension',
    fillBlank: 'Fill in the blank',
    shortAnswer: 'Short answer',
    quizYourself: 'Quiz yourself',
    generatingQuiz: 'Generating quiz…',
    typeAnswer: 'Type your answer…',
    nextQuestion: 'Next question',
    finishQuiz: 'Finish quiz',
    submitting: 'Submitting…',
    greatWork: 'Great work — keep it up!',
    tryAnother: 'Try another quiz',
    backToReading: 'Back to reading',
    openChapterFirst: 'Open a chapter in the Reader first',
    pickAnswer: 'Pick an answer before continuing',
    readerHint: 'Open any chapter in the Reader and tap Practice to quiz yourself on that exact passage.',
  },
  paywall: {
    unlockBook: 'Pay once to unlock this book in your library.',
    congratulations: 'Congratulations!',
    startReading: 'Start reading',
    failedPayment: 'Failed to start payment',
    cardVerificationFailed: 'Card verification failed',
    unlockFor: (amount) => `Unlock for ${amount}`,
    paymentNotStartedBook: 'Payment could not be started for this book.',
  },
  importReturn: {
    confirming: 'Confirming payment…',
    waitingAtmos: 'Waiting for Atmos confirmation…',
    missingReference: 'Missing payment reference',
    paymentConfirmed: 'Payment confirmed. Finish your import.',
    importReady: 'Import ready',
    reselectFile: 'Payment received. Please re-select your PDF/EPUB to finish the import.',
    paymentNotConfirmedToast: 'Payment not confirmed yet. If you were charged, open Import and try again in a moment.',
    importing: 'Payment confirmed — importing…',
    importSubmitted: 'Import submitted',
    couldNotFinishImport: 'Could not finish import after payment',
  },
  peerProfile: {
    title: 'Profile',
    loading: 'Loading profile…',
    message: (name) => `Message ${name}`,
    memberSince: (date) => `Member since ${date}`,
    booksRead: 'Books read',
    wordsLearned: 'Words learned',
    chats: 'Chats',
    languages: 'Languages',
    native: 'Native',
    currentlyReading: 'Currently Reading',
    percentRead: (n) => `${n}% read`,
    proficient: 'Proficient',
    intermediate: 'Intermediate',
    basic: 'Basic',
  },
  languageInput: {
    searchPlaceholder: 'Search languages...',
    addAnother: 'Add another…',
    noMatch: 'No matching language',
    remove: (name) => `Remove ${name}`,
  },
  statsPage: {
    last7Days: 'Last 7 days',
    last30Days: 'Last 30 days',
    currentStreak: 'Current streak',
    readingTime: 'Reading Time',
    vocabularyBreakdown: 'Vocabulary Breakdown',
    booksRead: 'Books read',
    noDataYet: 'No data yet',
    minutesRead: 'Minutes read',
    wordsAdded: 'Words added',
    dailyAverage: 'Daily average',
  },
  billing: {
    today: 'today',
    thisMonth: 'this month',
    thisYear: 'this year',
    importsFree: 'Imports are currently free (payments paused).',
    freeImportsLeft: (remaining, total, cycle) => `${remaining} of ${total} free imports left ${cycle}`,
    freePagesLeft: (remaining, total, cycle) => `${remaining} of ${total} free pages left ${cycle}`,
    configuredPool: (dailyImports, pageLimit, cycle) =>
      `Configured pool: ${dailyImports} imports/day · ${pageLimit} pages ${cycle}.`,
  },
  commonExt: {
    delete: 'Delete',
    read: 'Read',
    previous: 'Previous',
    next: 'Next',
    close: 'Close',
    confirm: 'Confirm',
    retry: 'Retry',
    error: 'Error',
    offline: 'Couldn\'t reach Gotcha. Check your connection and try again.',
    tooLong: 'That message is too long.',
    success: 'Success',
    new: 'New',
    days: 'days',
    minutes: 'min',
    hours: 'h',
    yesterday: 'Yesterday',
    today: 'Today',
  },
  vocabPage: {
    pageSubtitle: 'Build your personal word list while reading',
    loading: 'Loading vocabulary…',
    loadErrorTitle: 'Couldn’t load vocabulary',
    searchPlaceholder: 'Search words…',
    total: 'Total',
    due: 'Due',
    mastery: 'Mastery',
    word: 'Word',
    translation: 'Translation',
    status: 'Status',
    next: 'Next',
    interval: 'Interval',
    reps: 'Reps',
    actions: 'Actions',
    dueForReview: 'Due for review',
    markKnown: 'Mark known',
    remove: 'Remove',
    noMatchSearch: 'No words match your search',
    reviewDue: (count) => `Review ${count} due`,
    wordCountSummary: (total, learning, mastered) => `${total} word${total !== 1 ? 's' : ''} · ${learning} learning · ${mastered} mastered`,
    showingCount: (shown, total) => `Showing ${shown} of ${total}`,
    ratedAs: (lemma, rating) => `"${lemma}" rated as ${rating}`,
    filterAll: 'all',
    filterDue: (count) => `Due (${count})`,
    filterLearning: 'learning',
    filterKnown: 'known',
    overdue: (days) => `${days}d overdue`,
    tomorrow: 'Tomorrow',
    inDays: (days) => `in ${days}d`,
    statusLearning: 'learning',
    statusKnown: 'known',
  },
  notificationsPage: {
    filterAll: (count) => `All (${count})`,
    filterUnread: (count) => `Unread (${count})`,
    filterLibrary: (count) => `Library (${count})`,
    filterSystem: (count) => `System (${count})`,
    emptyUnread: 'No unread notifications',
    emptyLibrary: 'No new library alerts',
    catalogHint: 'New catalog books will show up here when they are published.',
    justNow: 'just now',
    minutesAgo: (mins) => `${mins}m ago`,
    hoursAgo: (hours) => `${hours}h ago`,
    daysAgo: (days) => `${days}d ago`,
  },
  charts: {
    noActivityInRange: 'No activity in this range',
    noWordSavesYet: 'No word saves yet',
    noWordsInRange: 'No words saved in this range',
    noBooksRead: 'No books read',
    booksRead: (count) => `${count} book${count === 1 ? '' : 's'} read`,
    booksReadFinished: (count, finished) =>
      `${count} book${count === 1 ? '' : 's'} read · ${finished} finished`,
  },
  errors: {
    lookupFailed: 'Lookup failed',
    saveFailed: 'Save failed',
    updateFailed: 'Update failed',
    reviewFailed: 'Review failed',
    importFailed: 'Import failed',
    uploadFailed: 'Upload failed',
    registrationFailed: 'Registration failed',
    failedLoadVocab: 'Failed to load vocabulary',
    requestFailed: 'Request failed',
    failedStartPayment: 'Failed to start payment',
    cardVerificationFailed: 'Card verification failed',
    unexpectedPaymentState: 'Unexpected payment state after card verification.',
    paymentNotConfirmedOtp: 'Payment not confirmed yet. Check the SMS code and try again.',
    paymentNotConfirmedCard: 'Payment not confirmed. Please try again with a different card.',
    couldNotResendOtp: 'Could not resend OTP',
    otpVerificationFailed: 'OTP verification failed',
    couldNotDeleteImport: 'Could not delete import',
    pronunciationUnavailable: 'Pronunciation is unavailable',
  },
  timeAgo: {
    justNow: 'just now',
    minutesAgo: (mins) => `${mins}m ago`,
    hoursAgo: (hours) => `${hours}h ago`,
    daysAgo: (days) => `${days}d ago`,
  },
};

const EXT_RU: LearnerCopyExt = {
  ...EXT_EN,
  authPages: {
    ...EXT_EN.authPages,
    forgotTitle: 'Сброс пароля',
    forgotSubtitle: 'Введите email — мы отправим ссылку для сброса.',
    forgotAdminSubtitle: 'Введите email админ-аккаунта. После сброса войдите для доступа к консоли.',
    sendResetLink: 'Отправить ссылку',
    sending: 'Отправка…',
    checkEmail: 'Проверьте почту',
    checkEmailBody: 'Если аккаунт существует, мы отправили ссылку. Она действует 1 час.',
    openEmailApp: 'Открыть почту',
    resendEmail: 'Отправить снова',
    didntReceive: 'Не получили?',
    useDifferentEmail: 'Другой email',
    enterEmail: 'Введите email',
    resetLinkSent: 'Проверьте почту — там ссылка для сброса',
    resetLinkResent: 'Письмо отправлено снова',
    couldNotSendReset: 'Не удалось отправить ссылку',
    couldNotResend: 'Не удалось отправить повторно',
    openInboxHint: (email) => `Откройте почту ${email || ''} и перейдите по ссылке.`,
    verifyTitle: 'Подтвердите email',
    verifySuccessTitle: 'Email подтверждён',
    verifyErrorTitle: 'Ссылка устарела',
    verifyingTitle: 'Проверка…',
    verifySuccessBody: 'Email подтверждён. Войдите, чтобы начать читать.',
    verifySuccessAdminBody: 'Email подтверждён. Войдите для доступа к админке.',
    verifyErrorBody: 'Ссылка недействительна или устарела. Запросите новую.',
    verifyingBody: 'Подтверждаем ваш email…',
    verifySentBody: 'Мы отправили ссылку на ваш email. Перейдите по ней для подтверждения.',
    verifySentAdminBody: 'Мы отправили ссылку. Подтвердите email, затем войдите в админку.',
    confirmEmail: 'Подтверждаем email…',
    resendVerification: 'Отправить письмо повторно',
    alreadyVerified: 'Уже подтверждён?',
    verifiedToast: 'Email подтверждён — можно войти',
    enterRegisteredEmail: 'Введите email регистрации',
    verificationSent: 'Письмо отправлено — проверьте почту',
    openAppTitle: 'Открываем приложение GOTCHA',
    openAppBody: 'Подтвердите email в приложении. Если не открылось — нажмите кнопку ниже.',
    openGotchaApp: 'Открыть GOTCHA',
    continueOnWeb: 'Продолжить в браузере',
    resetChooseTitle: 'Новый пароль',
    resetChooseSubtitle: 'Введите новый пароль для GOTCHA. Минимум 8 символов.',
    resetConfirmPlaceholder: 'Повторите пароль',
    resetUpdatedTitle: 'Пароль обновлён',
    resetUpdatedBody: 'Пароль изменён. Войдите с новым паролем.',
    resetUpdatedAdminBody: 'Пароль изменён. Войдите для доступа к админке.',
    linkInvalidTitle: 'Ссылка недействительна',
    linkInvalidBody: 'Ссылка отсутствует или неполная. Запросите новую на странице сброса.',
    resetLinkMissing: 'Ссылка для сброса недействительна',
    resetSuccessToast: 'Пароль обновлён — можно войти',
    couldNotReset: 'Не удалось сбросить пароль',
    saving: 'Сохранение…',
  },
  reader: {
    dictionary: 'Словарь',
    lookingUp: 'Поиск…',
    naturalMeaning: 'Значение',
    translation: 'Перевод',
    save: 'Сохранить',
    known: 'Знаю',
    ignore: 'Игнор',
    contentNotFound: 'Контент не найден',
    contentLoadFailed: 'Не удалось загрузить книгу. Проверьте подключение и попробуйте снова.',
    markAsLabel: '→ Отметить как:',
    tryAgain: 'Повторить',
    noSegments: 'Нет доступных фрагментов',
    stillProcessing: 'Возможно, материал ещё обрабатывается.',
    chapterOf: (n: number, total: number) => `Глава ${n} из ${total}`,
    chapterN: (n: number) => `Глава ${n}`,
    pageOf: (n: number, total: number) => `${n} из ${total}`,
    backToLibrary: 'Библиотека',
    unknown: 'неизвестно',
    learning: 'изучаю',
    unknownOnly: 'Только неизвестные',
    practice: 'Практика',
    chapters: 'Главы',
    collapse: 'Свернуть',
    page: (n) => `Стр. ${n}`,
    content: 'Контент',
    trialBanner: (price) => `Бесплатный фрагмент. Разблокируйте всё за ${price}.`,
    previous: 'Назад',
    next: 'Далее',
    unlockFullBook: 'Разблокировать книгу',
    finish: 'Завершить',
    readingComplete: 'Чтение завершено!',
    markedAs: (status) => `отмечено как ${status}`,
    savedToVocab: 'сохранено в словарь',
    lookupError: 'Не удалось найти слово',
    pronounceWord: 'Произнести слово',
    zoomOut: 'Уменьшить',
    zoomIn: 'Увеличить',
    unknownOnlyTitle: 'Показывать только неизвестные слова',
    practiceTitle: 'Тест по этой главе',
    goToPage: 'Перейти на страницу в главе',
    keepReadingSample: 'Продолжить читать фрагмент',
  },
  libraryPage: {
    goodMorning: 'Доброе утро',
    goodAfternoon: 'Добрый день',
    goodEvening: 'Добрый вечер',
    browseTitle: 'Библиотека',
    streak: 'Серия',
    words: 'Слова',
    days: (n) => `${n} дн.`,
    trySample: 'Пример',
    newBadge: 'Новое',
    percentRead: (n) => `${n}% прочитано`,
    percentKnown: (n) => `${n}% известно`,
    resume: 'Продолжить',
    yourLibraryEmpty: 'Библиотека пуста',
    loadErrorTitle: 'Не удалось загрузить библиотеку',
    loadErrorBody: 'Проверьте соединение и попробуйте ещё раз.',
    noContentFound: 'Контент не найден',
    newInLibrary: 'Новое в библиотеке',
    yourImports: 'Ваши импорты',
    continueReading: 'Продолжить чтение',
    recommended: 'Рекомендуем',
    streakStartToday: (minutes) => `Читайте ${minutes} мин сегодня, чтобы начать серию.`,
    streakDayOne: 'День 1 — продолжайте завтра!',
    streakKeepAlive: 'Поддерживайте серию — у вас отлично получается!',
    newMaterialLabel: 'Новый материал',
    newMaterialHint: 'На главной библиотеки — откройте, когда захотите читать или купить.',
    learnerFallback: 'Ученик',
  },
  importPage: {
    pageTitle: 'Импорт контента',
    pageSubtitle: 'Добавьте свои тексты, статьи и документы.',
    statusReady: 'Готово',
    statusProcessing: 'Обработка',
    statusQueued: 'В очереди',
    statusFailed: 'Ошибка',
    language: 'Язык',
    titleOptional: 'Название (необяз.)',
    importFromUrl: 'Импорт по URL',
    importText: 'Импорт текста',
    uploadFile: 'Загрузить файл',
    pastePlaceholder: 'Вставьте текст…',
    wordsNeeded: 'слов не хватает',
    onlyPdfEpub: 'Поддерживаются только PDF и EPUB',
    dropFile: 'Перетащите PDF или ePub',
    importHistory: 'История импорта',
    read: 'Читать',
    delete: 'Удалить',
    previous: 'Назад',
    next: 'Далее',
    enterCardDetails: 'Данные карты',
    enterSmsCode: 'SMS-код',
    purchaseFor: (amount) => `Оплатить ${amount}`,
    confirmPayment: 'Подтвердить оплату',
    resendCode: 'Отправить код снова',
    importReady: 'Импорт готов к чтению',
    importLimitReached: 'Лимит импорта исчерпан',
    deleteImport: 'Удалить импорт',
    deleteConfirm: 'Удалить этот импорт навсегда?',
    titleLabel: 'Название',
    textLabel: 'Текст',
    titlePlaceholder: 'Мой текст',
    autoFromPage: 'Автоопределение со страницы',
    autoFromFilename: 'Авто из имени файла',
    urlHelp: 'Работает с Gutenberg, Wikipedia, публичными статьями и .txt URL. Романы делятся на главы. Платные страницы вызовут ошибку.',
    textTooLong: (maxChars) => `Текст превышает ${maxChars.toLocaleString()} символов. Разделите на несколько импортов.`,
    freeAllowanceCovered: 'Покрыто бесплатным лимитом импорта.',
    lengthNotPriced: 'Такая длина пока не оценена. Попробуйте короче или позже.',
    allowanceReachedPaid: 'Лимит импорта исчерпан. Удалите старый импорт или оплатите через Atmos.',
    allowanceReachedFree: 'Лимит импорта исчерпан. Удалите старый импорт — платный импорт сейчас недоступен.',
    paidImportsHint: 'Платный импорт оплачивается по числу страниц в сумах через Atmos. Сначала используется бесплатный лимит.',
    freeImportsHint: 'Тариф Free: 3 импорта в день и 50 страниц в месяц. Дневные лимиты обновляются в 00:00 по ташкентскому времени, страницы — 1-го числа.',
    importRemoved: 'Импорт удалён из истории',
    pageTier: (label) => `Тариф страниц (${label})`,
    estimatedPages: 'Примерно страниц',
    total: 'Итого',
    pagesProgress: (done, total) => `${done} / ${total} стр.`,
    freeLeftToday: (remaining, total) => `${remaining} бесплатных сегодня · ${total} имп.`,
    importsCount: (total) => `${total} имп.`,
    importsCountLimit: (total, limit) => `${total} / ${limit} импортов`,
  },
  messagesPage: {
    recentChats: 'НЕДАВНИЕ ЧАТЫ',
    noConversationsHint: 'Диалогов пока нет. Начните общение с другими учениками!',
    yesterday: 'Вчера',
    typing: 'печатает…',
    online: 'в сети',
    lastSeen: (time) => `был(а) ${time} назад`,
    selectConversation: 'Выберите диалог',
    loadingConversation: 'Загрузка…',
    chatTip: 'Совет: нажмите на слово в сообщении для перевода.',
    reply: 'Ответить',
    edit: 'Изменить',
    delete: 'Удалить',
    messageDeleted: 'Сообщение удалено',
    edited: 'изменено',
    translateFailed: 'Не удалось перевести',
    emptyTitle: 'Пока нет разговоров',
    emptyBody: 'Писать можно друзьям. Отправьте запрос в друзья.',
    sendFriend: 'Отправить запрос в друзья',
    birthYearBanner: 'Укажите год рождения, чтобы писать сообщения',
    recipientNotEligible: 'Этот ученик пока не может получать сообщения.',
    you: 'Вы',
    wordMeaning: 'Значение слова',
    editingMessage: 'Редактирование',
    replyTo: (name) => `Ответ ${name}`,
    deleteForEveryone: 'Удалить для всех?',
    deleteConfirm: 'Удалить сообщение?',
    chatTipTitle: 'Нажмите на слово или выделите фразу',
    suggestedFromReadings: 'ИЗ ВАШИХ ЧТЕНИЙ',
    learner: 'Ученик',
  },
  practicePage: {
    practiceWhatYouRead: 'Практика по прочитанному',
    goToLibrary: 'В библиотеку',
    comprehension: 'Понимание',
    fillBlank: 'Пропуск',
    shortAnswer: 'Краткий ответ',
    quizYourself: 'Проверь себя',
    generatingQuiz: 'Генерация теста…',
    typeAnswer: 'Введите ответ…',
    nextQuestion: 'Следующий вопрос',
    finishQuiz: 'Завершить тест',
    submitting: 'Отправка…',
    greatWork: 'Отлично — так держать!',
    tryAnother: 'Ещё один тест',
    backToReading: 'К чтению',
    openChapterFirst: 'Сначала откройте главу в читалке',
    pickAnswer: 'Выберите ответ',
    readerHint: 'Откройте главу в читалке и нажмите «Практика» для теста по этому отрывку.',
  },
  paywall: {
    unlockBook: 'Оплатите один раз, чтобы разблокировать книгу.',
    congratulations: 'Поздравляем!',
    startReading: 'Начать чтение',
    failedPayment: 'Не удалось начать оплату',
    cardVerificationFailed: 'Ошибка проверки карты',
    unlockFor: (amount) => `Разблокировать за ${amount}`,
    paymentNotStartedBook: 'Не удалось начать оплату за эту книгу.',
  },
  importReturn: {
    confirming: 'Подтверждение оплаты…',
    waitingAtmos: 'Ожидание подтверждения Atmos…',
    missingReference: 'Отсутствует ссылка на оплату',
    paymentConfirmed: 'Оплата подтверждена. Завершите импорт.',
    importReady: 'Импорт готов',
    reselectFile: 'Оплата получена. Выберите PDF/EPUB снова для завершения.',
    paymentNotConfirmedToast: 'Оплата ещё не подтверждена. Если списали — откройте Импорт и повторите.',
    importing: 'Оплата подтверждена — импорт…',
    importSubmitted: 'Импорт отправлен',
    couldNotFinishImport: 'Не удалось завершить импорт после оплаты',
  },
  peerProfile: {
    title: 'Профиль',
    loading: 'Загрузка…',
    message: (name) => `Написать ${name}`,
    memberSince: (date) => `Участник с ${date}`,
    booksRead: 'Книг прочитано',
    wordsLearned: 'Слов выучено',
    chats: 'Чаты',
    languages: 'Языки',
    native: 'Родной',
    currentlyReading: 'Сейчас читает',
    percentRead: (n) => `${n}% прочитано`,
    proficient: 'Продвинутый',
    intermediate: 'Средний',
    basic: 'Базовый',
  },
  languageInput: {
    searchPlaceholder: 'Поиск языка...',
    addAnother: 'Добавить…',
    noMatch: 'Язык не найден',
    remove: (name) => `Удалить ${name}`,
  },
  statsPage: {
    last7Days: '7 дней',
    last30Days: '30 дней',
    currentStreak: 'Текущая серия',
    readingTime: 'Время чтения',
    vocabularyBreakdown: 'Словарь',
    booksRead: 'Книг прочитано',
    noDataYet: 'Данных пока нет',
    minutesRead: 'Минут прочитано',
    wordsAdded: 'Слов добавлено',
    dailyAverage: 'Среднее в день',
  },
  billing: {
    today: 'сегодня',
    thisMonth: 'в этом месяце',
    thisYear: 'в этом году',
    importsFree: 'Импорт сейчас бесплатен (оплата приостановлена).',
    freeImportsLeft: (remaining, total, cycle) => `${remaining} из ${total} бесплатных импортов ${cycle}`,
    freePagesLeft: (remaining, total, cycle) => `${remaining} из ${total} бесплатных страниц ${cycle}`,
    configuredPool: (dailyImports, pageLimit, cycle) =>
      `Лимит: ${dailyImports} имп./день · ${pageLimit} стр. ${cycle}.`,
  },
  commonExt: {
    delete: 'Удалить',
    read: 'Читать',
    previous: 'Назад',
    next: 'Далее',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    retry: 'Повторить',
    error: 'Ошибка',
    offline: 'Нет связи с Gotcha. Проверьте интернет и попробуйте снова.',
    tooLong: 'Слишком длинное сообщение.',
    success: 'Успех',
    new: 'Новое',
    days: 'дн.',
    minutes: 'мин.',
    hours: 'ч.',
    yesterday: 'Вчера',
    today: 'Сегодня',
  },
  vocabPage: {
    pageSubtitle: 'Создавайте личный словарь во время чтения',
    loading: 'Загрузка словаря…',
    loadErrorTitle: 'Не удалось загрузить словарь',
    searchPlaceholder: 'Поиск слов…',
    total: 'Всего',
    due: 'К повтору',
    mastery: 'Освоение',
    word: 'Слово',
    translation: 'Перевод',
    status: 'Статус',
    next: 'Далее',
    interval: 'Интервал',
    reps: 'Повт.',
    actions: 'Действия',
    dueForReview: 'К повтору',
    markKnown: 'Знаю',
    remove: 'Удалить',
    noMatchSearch: 'Нет слов по запросу',
    reviewDue: (count) => `Повторить ${count}`,
    wordCountSummary: (total, learning, mastered) => `${total} ${pluralRu(total, 'слово', 'слова', 'слов')} · ${learning} изучаю · ${mastered} освоено`,
    showingCount: (shown, total) => `Показано ${shown} из ${total}`,
    ratedAs: (lemma, rating) => `«${lemma}» — ${rating}`,
    filterAll: 'все',
    filterDue: (count) => `К повтору (${count})`,
    filterLearning: 'изучаю',
    filterKnown: 'освоено',
    overdue: (days) => `${days} дн. просрочено`,
    tomorrow: 'Завтра',
    inDays: (days) => `через ${days} дн.`,
    statusLearning: 'изучаю',
    statusKnown: 'освоено',
  },
  notificationsPage: {
    filterAll: (count) => `Все (${count})`,
    filterUnread: (count) => `Непрочит. (${count})`,
    filterLibrary: (count) => `Библиотека (${count})`,
    filterSystem: (count) => `Система (${count})`,
    emptyUnread: 'Нет непрочитанных',
    emptyLibrary: 'Нет новых уведомлений библиотеки',
    catalogHint: 'Новые книги каталога появятся здесь после публикации.',
    justNow: 'только что',
    minutesAgo: (mins) => `${mins} мин назад`,
    hoursAgo: (hours) => `${hours} ч назад`,
    daysAgo: (days) => `${days} дн назад`,
  },
  charts: {
    noActivityInRange: 'Нет активности за период',
    noWordSavesYet: 'Слов пока не сохранено',
    noWordsInRange: 'Нет сохранённых слов за период',
    noBooksRead: 'Книг не прочитано',
    booksRead: (count) => `${count} ${pluralRu(count, 'книга прочитана', 'книги прочитаны', 'книг прочитано')}`,
    booksReadFinished: (count, finished) =>
      `Прочитано: ${count} ${pluralRu(count, 'книга', 'книги', 'книг')} · завершено: ${finished}`,
  },
  errors: {
    lookupFailed: 'Поиск не удался',
    saveFailed: 'Не удалось сохранить',
    updateFailed: 'Не удалось обновить',
    reviewFailed: 'Повтор не удался',
    importFailed: 'Импорт не удался',
    uploadFailed: 'Загрузка не удалась',
    registrationFailed: 'Регистрация не удалась',
    failedLoadVocab: 'Не удалось загрузить словарь',
    requestFailed: 'Запрос не удался',
    failedStartPayment: 'Не удалось начать оплату',
    cardVerificationFailed: 'Ошибка проверки карты',
    unexpectedPaymentState: 'Неожиданное состояние после проверки карты.',
    paymentNotConfirmedOtp: 'Оплата не подтверждена. Проверьте SMS-код.',
    paymentNotConfirmedCard: 'Оплата не подтверждена. Попробуйте другую карту.',
    couldNotResendOtp: 'Не удалось отправить код повторно',
    otpVerificationFailed: 'Ошибка проверки OTP',
    couldNotDeleteImport: 'Не удалось удалить импорт',
    pronunciationUnavailable: 'Произношение недоступно',
  },
  timeAgo: {
    justNow: 'только что',
    minutesAgo: (mins) => `${mins} мин назад`,
    hoursAgo: (hours) => `${hours} ч назад`,
    daysAgo: (days) => `${days} дн назад`,
  },
};

const EXT_UZ: LearnerCopyExt = {
  ...EXT_EN,
  authPages: {
    ...EXT_EN.authPages,
    forgotTitle: 'Parolni tiklash',
    forgotSubtitle: 'Emailingizni kiriting — tiklash havolasini yuboramiz.',
    forgotAdminSubtitle: 'Admin emailini kiriting. Tiklagach, konsolga qaytish uchun kiring.',
    sendResetLink: 'Havola yuborish',
    sending: 'Yuborilmoqda…',
    checkEmail: 'Pochtani tekshiring',
    checkEmailBody: 'Agar hisob mavjud boʻlsa, tiklash havolasi yuborildi. 1 soat amal qiladi.',
    openEmailApp: 'Pochta ilovasini ochish',
    resendEmail: 'Qayta yuborish',
    didntReceive: 'Kelmadi?',
    useDifferentEmail: 'Boshqa email',
    enterEmail: 'Email kiriting',
    resetLinkSent: 'Pochtada tiklash havolasini tekshiring',
    resetLinkResent: 'Xat qayta yuborildi',
    couldNotSendReset: 'Havola yuborilmadi',
    couldNotResend: 'Qayta yuborib boʻlmadi',
    openInboxHint: (email) => `${email || 'pochta'} qutisini oching va havolani bosing.`,
    verifyTitle: 'Emailni tasdiqlang',
    verifySuccessTitle: 'Email tasdiqlandi',
    verifyErrorTitle: 'Havola muddati tugagan',
    verifyingTitle: 'Tekshirilmoqda…',
    verifySuccessBody: 'Email tasdiqlandi. Oʻqishni boshlash uchun kiring.',
    verifySuccessAdminBody: 'Email tasdiqlandi. Admin konsoliga qaytish uchun kiring.',
    verifyErrorBody: 'Havola notoʻgʻri yoki muddati tugagan. Yangisini soʻrang.',
    verifyingBody: 'Emailingiz tasdiqlanmoqda…',
    verifySentBody: 'Tasdiqlash havolasi emailingizga yuborildi. Hisobni tasdiqlash uchun bosing.',
    verifySentAdminBody: 'Havola yuborildi. Emailni tasdiqlang, keyin admin konsoliga kiring.',
    confirmEmail: 'Email tasdiqlanmoqda…',
    resendVerification: 'Tasdiqlash xatini qayta yuborish',
    alreadyVerified: 'Allaqachon tasdiqlanganmi?',
    verifiedToast: 'Email tasdiqlandi — kira olasiz',
    enterRegisteredEmail: 'Roʻyxatdan oʻtgan emailingizni kiriting',
    verificationSent: 'Tasdiqlash xati yuborildi',
    openAppTitle: 'GOTCHA ilovasi ochilmoqda',
    openAppBody: 'Emailni ilovada tasdiqlang. Ochilmasa, quyidagi tugmani bosing.',
    openGotchaApp: 'GOTCHA ilovasini ochish',
    continueOnWeb: 'Vebda davom etish',
    resetChooseTitle: 'Yangi parol',
    resetChooseSubtitle: 'GOTCHA uchun yangi parol. Kamida 8 belgi.',
    resetConfirmPlaceholder: 'Parolni takrorlang',
    resetUpdatedTitle: 'Parol yangilandi',
    resetUpdatedBody: 'Parol oʻzgartirildi. Yangi parol bilan kiring.',
    resetUpdatedAdminBody: 'Parol oʻzgartirildi. Admin konsoliga qaytish uchun kiring.',
    linkInvalidTitle: 'Havola notoʻgʻri',
    linkInvalidBody: 'Havola yoʻq yoki toʻliq emas. Parolni tiklash sahifasidan yangisini soʻrang.',
    resetLinkMissing: 'Tiklash havolasi notoʻgʻri',
    resetSuccessToast: 'Parol yangilandi — kira olasiz',
    couldNotReset: 'Parolni tiklab boʻlmadi',
    saving: 'Saqlanmoqda…',
  },
  reader: {
    dictionary: 'Lugʻat',
    lookingUp: 'Qidirilmoqda…',
    naturalMeaning: 'Maʼno',
    translation: 'Tarjima',
    save: 'Saqlash',
    known: 'Maʼlum',
    ignore: 'Eʼtiborsiz',
    contentNotFound: 'Kontent topilmadi',
    contentLoadFailed: 'Kitobni yuklab boʻlmadi. Internetni tekshirib, qayta urinib koʻring.',
    markAsLabel: '→ Belgilash:',
    tryAgain: 'Qayta urinish',
    noSegments: 'Boʻlimlar mavjud emas',
    stillProcessing: 'Material hali qayta ishlanayotgan boʻlishi mumkin.',
    chapterOf: (n: number, total: number) => `${n}-bob, jami ${total}`,
    chapterN: (n: number) => `${n}-bob`,
    pageOf: (n: number, total: number) => `${n} / ${total}`,
    backToLibrary: 'Kutubxona',
    unknown: 'nomaʼlum',
    learning: 'oʻrganilmoqda',
    unknownOnly: 'Faqat nomaʼlum',
    practice: 'Mashq',
    chapters: 'Boblar',
    collapse: 'Yigʻish',
    page: (n) => `${n}-sahifa`,
    content: 'Kontent',
    trialBanner: (price) => `Bepul namuna. Qolganini ${price} ga oching.`,
    previous: 'Oldingi',
    next: 'Keyingi',
    unlockFullBook: 'Toʻliq kitobni ochish',
    finish: 'Tugatish',
    readingComplete: 'Oʻqish tugadi!',
    markedAs: (status) => `${status} deb belgilandi`,
    savedToVocab: 'lugʻatga saqlandi',
    lookupError: 'Soʻz topilmadi',
    pronounceWord: 'Soʻzni talaffuz qilish',
    zoomOut: 'Kichiklashtirish',
    zoomIn: 'Kattalashtirish',
    unknownOnlyTitle: 'Faqat nomaʼlum soʻzlar',
    practiceTitle: 'Bu bob boʻyicha test',
    goToPage: 'Bobdagi sahifaga oʻtish',
    keepReadingSample: 'Namunani oʻqishda davom etish',
  },
  libraryPage: {
    goodMorning: 'Xayrli tong',
    goodAfternoon: 'Xayrli kun',
    goodEvening: 'Xayrli kech',
    browseTitle: 'Kutubxonani koʻrish',
    streak: 'Seriya',
    words: 'Soʻzlar',
    days: (n) => `${n} kun`,
    trySample: 'Namuna',
    newBadge: 'Yangi',
    percentRead: (n) => `${n}% oʻqilgan`,
    percentKnown: (n) => `${n}% maʼlum`,
    resume: 'Davom etish',
    yourLibraryEmpty: 'Kutubxona boʻsh',
    loadErrorTitle: 'Kutubxonani yuklab boʻlmadi',
    loadErrorBody: 'Aloqani tekshirib, qayta urinib koʻring.',
    noContentFound: 'Kontent topilmadi',
    newInLibrary: 'Kutubxonada yangi',
    yourImports: 'Importlaringiz',
    continueReading: 'Oʻqishni davom ettirish',
    recommended: 'Sizga tavsiya',
    streakStartToday: (minutes) => `Seriyani boshlash uchun bugun ${minutes} daqiqa oʻqing.`,
    streakDayOne: '1-kun — ertaga ham davom eting!',
    streakKeepAlive: 'Seriyani saqlab qoling — ajoyib ketmoqdasiz!',
    newMaterialLabel: 'Yangi material',
    newMaterialHint: 'Kutubxona bosh sahifasida — oʻqish yoki sotib olish uchun oching.',
    learnerFallback: 'Oʻquvchi',
  },
  importPage: {
    pageTitle: 'Kontent import',
    pageSubtitle: 'Oʻz matn, maqola va hujjatlaringizni qoʻshing.',
    statusReady: 'Tayyor',
    statusProcessing: 'Ishlanmoqda',
    statusQueued: 'Navbatda',
    statusFailed: 'Xato',
    language: 'Til',
    titleOptional: 'Sarlavha (ixtiyoriy)',
    importFromUrl: 'URL dan import',
    importText: 'Matn import',
    uploadFile: 'Fayl yuklash',
    pastePlaceholder: 'Matnni shu yerga qoʻying…',
    wordsNeeded: 'soʻz yetishmaydi',
    onlyPdfEpub: 'Faqat PDF va EPUB qoʻllab-quvvatlanadi',
    dropFile: 'PDF yoki ePub tashlang',
    importHistory: 'Import tarixi',
    read: 'Oʻqish',
    delete: 'Oʻchirish',
    previous: 'Oldingi',
    next: 'Keyingi',
    enterCardDetails: 'Karta maʼlumotlari',
    enterSmsCode: 'SMS-kod',
    purchaseFor: (amount) => `${amount} ga sotib olish`,
    confirmPayment: 'Toʻlovni tasdiqlash',
    resendCode: 'Kodni qayta yuborish',
    importReady: 'Import oʻqishga tayyor',
    importLimitReached: 'Import limiti tugadi',
    deleteImport: 'Importni oʻchirish',
    deleteConfirm: 'Bu import butunlay oʻchirilsinmi?',
    titleLabel: 'Sarlavha',
    textLabel: 'Matn',
    titlePlaceholder: 'Mening matnim',
    autoFromPage: 'Sahifadan avtomatik',
    autoFromFilename: 'Fayl nomidan avtomatik',
    urlHelp: 'Gutenberg, Wikipedia, ochiq maqolalar va .txt URL lar bilan ishlaydi. Romanlar boblar boʻlinadi. Pullik sahifalar xato beradi.',
    textTooLong: (maxChars) => `Matn ${maxChars.toLocaleString()} belgidan oshdi. Bir nechta importga boʻling.`,
    freeAllowanceCovered: 'Bepul import limiti qoplab beradi.',
    lengthNotPriced: 'Bu uzunlik hali baholanmagan. Qisqaroq hujjat yoki keyinroq urinib koʻring.',
    allowanceReachedPaid: 'Import limiti tugadi. Eski importni oʻchiring yoki Atmos orqali toʻlang.',
    allowanceReachedFree: 'Import limiti tugadi. Eski importni oʻchiring — pullik import hozir yoʻq.',
    paidImportsHint: 'Pullik import sahifalar soniga qarab soʻmda Atmos orqali toʻlanadi. Avval bepul limit ishlatiladi.',
    freeImportsHint: 'Bepul tarif: kuniga 3 ta import va oyiga 50 sahifa. Kunlik limitlar Toshkent vaqti bilan 00:00 da, sahifalar har oyning 1-sanasida yangilanadi.',
    importRemoved: 'Import tarixdan olib tashlandi',
    pageTier: (label) => `Sahifa tarifi (${label})`,
    estimatedPages: 'Taxminiy sahifalar',
    total: 'Jami',
    pagesProgress: (done, total) => `${done} / ${total} sahifa`,
    freeLeftToday: (remaining, total) => `Bugun ${remaining} bepul · ${total} import`,
    importsCount: (total) => `${total} import`,
    importsCountLimit: (total, limit) => `${total} / ${limit} import`,
  },
  messagesPage: {
    recentChats: 'SOʻNGGI SUHBATLAR',
    noConversationsHint: 'Hali suhbat yoʻq. Boshqa oʻquvchilar bilan suhbat boshlang!',
    yesterday: 'Kecha',
    typing: 'yozmoqda…',
    online: 'onlayn',
    lastSeen: (time) => `${time} oldin koʻrilgan`,
    selectConversation: 'Suhbat tanlang',
    loadingConversation: 'Yuklanmoqda…',
    chatTip: 'Maslahat: xabardagi soʻzni bosib tarjima oling.',
    reply: 'Javob',
    edit: 'Tahrirlash',
    delete: 'Oʻchirish',
    messageDeleted: 'Xabar oʻchirildi',
    edited: 'tahrirlangan',
    translateFailed: 'Tarjima qilib boʻlmadi',
    emptyTitle: 'Hali suhbat yoʻq',
    emptyBody: 'Xabar yozish doʻstlar uchun. Boshlash uchun doʻstlik soʻrovi yuboring.',
    sendFriend: 'Doʻstlik soʻrovi',
    birthYearBanner: 'Xabar yozish uchun tugʻilgan yilingizni kiriting',
    recipientNotEligible: 'Bu oʻquvchi hozircha xabar qabul qila olmaydi.',
    you: 'Siz',
    wordMeaning: 'Soʻz maʼnosi',
    editingMessage: 'Xabar tahrirlanmoqda',
    replyTo: (name) => `${name} ga javob`,
    deleteForEveryone: 'Hammaga oʻchirilsinmi?',
    deleteConfirm: 'Xabar oʻchirilsinmi?',
    chatTipTitle: 'Soʻzni bosing yoki iborani belgilab ushlab turing',
    suggestedFromReadings: 'OʻQISH BOʻYICHA TAVSIYA',
    learner: 'Oʻquvchi',
  },
  practicePage: {
    practiceWhatYouRead: 'Oʻqiganingizni mashq qiling',
    goToLibrary: 'Kutubxonaga',
    comprehension: 'Tushunish',
    fillBlank: 'Boʻsh joy',
    shortAnswer: 'Qisqa javob',
    quizYourself: 'Oʻzingizni sinang',
    generatingQuiz: 'Test yaratilmoqda…',
    typeAnswer: 'Javob yozing…',
    nextQuestion: 'Keyingi savol',
    finishQuiz: 'Testni tugatish',
    submitting: 'Yuborilmoqda…',
    greatWork: 'Ajoyib — davom eting!',
    tryAnother: 'Yana test',
    backToReading: 'Oʻqishga qaytish',
    openChapterFirst: 'Avval oʻqishda bob oching',
    pickAnswer: 'Javob tanlang',
    readerHint: 'Oʻqishda bob oching va shu parcha boʻyicha mashq uchun «Mashq» ni bosing.',
  },
  paywall: {
    unlockBook: 'Kitobni bir marta toʻlab kutubxonada oching.',
    congratulations: 'Tabriklaymiz!',
    startReading: 'Oʻqishni boshlash',
    failedPayment: 'Toʻlovni boshlab boʻlmadi',
    cardVerificationFailed: 'Karta tekshiruvi xato',
    unlockFor: (amount) => `${amount} ga ochish`,
    paymentNotStartedBook: 'Bu kitob uchun toʻlovni boshlab boʻlmadi.',
  },
  importReturn: {
    confirming: 'Toʻlov tasdiqlanmoqda…',
    waitingAtmos: 'Atmos tasdiqlashi kutilmoqda…',
    missingReference: 'Toʻlov havolasi yoʻq',
    paymentConfirmed: 'Toʻlov tasdiqlandi. Importni yakunlang.',
    importReady: 'Import tayyor',
    reselectFile: 'Toʻlov qabul qilindi. Importni yakunlash uchun PDF/EPUB ni qayta tanlang.',
    paymentNotConfirmedToast: 'Toʻlov hali tasdiqlanmadi. Pul yechilgan boʻlsa, Importni ochib qayta urinib koʻring.',
    importing: 'Toʻlov tasdiqlandi — import qilinmoqda…',
    importSubmitted: 'Import yuborildi',
    couldNotFinishImport: 'Toʻlovdan keyin importni yakunlab boʻlmadi',
  },
  peerProfile: {
    title: 'Profil',
    loading: 'Yuklanmoqda…',
    message: (name) => `${name}ga yozish`,
    memberSince: (date) => `${date} dan aʼzo`,
    booksRead: 'Oʻqilgan kitoblar',
    wordsLearned: 'Oʻrganilgan soʻzlar',
    chats: 'Suhbatlar',
    languages: 'Tillar',
    native: 'Ona tili',
    currentlyReading: 'Hozir oʻqimoqda',
    percentRead: (n) => `${n}% oʻqilgan`,
    proficient: 'Yuqori',
    intermediate: 'Oʻrta',
    basic: 'Boshlangʻich',
  },
  languageInput: {
    searchPlaceholder: 'Til qidirish...',
    addAnother: 'Yana qoʻshish…',
    noMatch: 'Til topilmadi',
    remove: (name) => `${name} ni olib tashlash`,
  },
  statsPage: {
    last7Days: '7 kun',
    last30Days: '30 kun',
    currentStreak: 'Joriy seriya',
    readingTime: 'Oʻqish vaqti',
    vocabularyBreakdown: 'Lugʻat tahlili',
    booksRead: 'Oʻqilgan kitoblar',
    noDataYet: 'Hali maʼlumot yoʻq',
    minutesRead: 'Oʻqilgan daqiqalar',
    wordsAdded: 'Qoʻshilgan soʻzlar',
    dailyAverage: 'Kunlik oʻrtacha',
  },
  billing: {
    today: 'bugun',
    thisMonth: 'bu oy',
    thisYear: 'bu yil',
    importsFree: 'Import hozir bepul (toʻlov toʻxtatilgan).',
    freeImportsLeft: (remaining, total, cycle) => `${cycle} ${total} dan ${remaining} bepul import qoldi`,
    freePagesLeft: (remaining, total, cycle) => `${cycle} ${total} dan ${remaining} bepul sahifa qoldi`,
    configuredPool: (dailyImports, pageLimit, cycle) =>
      `Limit: kuniga ${dailyImports} import · ${pageLimit} sahifa ${cycle}.`,
  },
  commonExt: {
    delete: 'Oʻchirish',
    read: 'Oʻqish',
    previous: 'Oldingi',
    next: 'Keyingi',
    close: 'Yopish',
    confirm: 'Tasdiqlash',
    retry: 'Qayta urinish',
    error: 'Xato',
    offline: 'Gotcha bilan aloqa yoʻq. Internetni tekshirib, qayta urinib koʻring.',
    tooLong: 'Xabar juda uzun.',
    success: 'Muvaffaqiyat',
    new: 'Yangi',
    days: 'kun',
    minutes: 'daq.',
    hours: 'soat',
    yesterday: 'Kecha',
    today: 'Bugun',
  },
  vocabPage: {
    pageSubtitle: 'Oʻqish paytida shaxsiy soʻzlar roʻyxatini yarating',
    loading: 'Lugʻat yuklanmoqda…',
    loadErrorTitle: 'Lugʻatni yuklab boʻlmadi',
    searchPlaceholder: 'Soʻzlarni qidirish…',
    total: 'Jami',
    due: 'Muddat',
    mastery: 'Oʻzlashtirish',
    word: 'Soʻz',
    translation: 'Tarjima',
    status: 'Holat',
    next: 'Keyingi',
    interval: 'Interval',
    reps: 'Takror',
    actions: 'Amallar',
    dueForReview: 'Takror uchun',
    markKnown: 'Maʼlum deb belgilash',
    remove: 'Olib tashlash',
    noMatchSearch: 'Qidiruvga mos soʻz yoʻq',
    reviewDue: (count) => `${count} ta takror`,
    wordCountSummary: (total, learning, mastered) => `${total} soʻz · ${learning} oʻrganilmoqda · ${mastered} oʻzlashtirilgan`,
    showingCount: (shown, total) => `${total} tadan ${shown} tasi koʻrsatilmoqda`,
    ratedAs: (lemma, rating) => `«${lemma}» — ${rating}`,
    filterAll: 'hammasi',
    filterDue: (count) => `Muddat (${count})`,
    filterLearning: 'oʻrganilmoqda',
    filterKnown: 'oʻzlashtirilgan',
    overdue: (days) => `${days} kun kechikdi`,
    tomorrow: 'Ertaga',
    inDays: (days) => `${days} kundan keyin`,
    statusLearning: 'oʻrganilmoqda',
    statusKnown: 'oʻzlashtirilgan',
  },
  notificationsPage: {
    filterAll: (count) => `Hammasi (${count})`,
    filterUnread: (count) => `Oʻqilmagan (${count})`,
    filterLibrary: (count) => `Kutubxona (${count})`,
    filterSystem: (count) => `Tizim (${count})`,
    emptyUnread: 'Oʻqilmagan bildirishnoma yoʻq',
    emptyLibrary: 'Yangi kutubxona xabarlari yoʻq',
    catalogHint: 'Katalogdagi yangi kitoblar nashr qilinganda shu yerda koʻrinadi.',
    justNow: 'hozirgina',
    minutesAgo: (mins) => `${mins} daq oldin`,
    hoursAgo: (hours) => `${hours} soat oldin`,
    daysAgo: (days) => `${days} kun oldin`,
  },
  charts: {
    noActivityInRange: 'Bu davrda faoliyat yoʻq',
    noWordSavesYet: 'Hali saqlangan soʻz yoʻq',
    noWordsInRange: 'Bu davrda saqlangan soʻz yoʻq',
    noBooksRead: 'Oʻqilgan kitob yoʻq',
    booksRead: (count) => `${count} kitob oʻqilgan`,
    booksReadFinished: (count, finished) => `${count} kitob oʻqilgan · ${finished} tugatilgan`,
  },
  errors: {
    lookupFailed: 'Qidiruv muvaffaqiyatsiz',
    saveFailed: 'Saqlab boʻlmadi',
    updateFailed: 'Yangilab boʻlmadi',
    reviewFailed: 'Takror muvaffaqiyatsiz',
    importFailed: 'Import muvaffaqiyatsiz',
    uploadFailed: 'Yuklab boʻlmadi',
    registrationFailed: 'Roʻyxatdan oʻtish muvaffaqiyatsiz',
    failedLoadVocab: 'Lugʻatni yuklab boʻlmadi',
    requestFailed: 'Soʻrov muvaffaqiyatsiz',
    failedStartPayment: 'Toʻlovni boshlab boʻlmadi',
    cardVerificationFailed: 'Karta tekshiruvi xato',
    unexpectedPaymentState: 'Karta tekshiruvidan keyin kutilmagan holat.',
    paymentNotConfirmedOtp: 'Toʻlov tasdiqlanmadi. SMS-kodni tekshiring.',
    paymentNotConfirmedCard: 'Toʻlov tasdiqlanmadi. Boshqa kartadan urinib koʻring.',
    couldNotResendOtp: 'Kodni qayta yuborib boʻlmadi',
    otpVerificationFailed: 'OTP tekshiruvi xato',
    couldNotDeleteImport: 'Importni oʻchirib boʻlmadi',
    pronunciationUnavailable: 'Talaffuz mavjud emas',
  },
  timeAgo: {
    justNow: 'hozirgina',
    minutesAgo: (mins) => `${mins} daq oldin`,
    hoursAgo: (hours) => `${hours} soat oldin`,
    daysAgo: (days) => `${days} kun oldin`,
  },
};

const EXT_COPIES: Record<UiLanguage, LearnerCopyExt> = { en: EXT_EN, ru: EXT_RU, uz: EXT_UZ };

export function learnerCopyExtFor(locale: UiLanguage): LearnerCopyExt {
  return EXT_COPIES[locale] ?? EXT_EN;
}
