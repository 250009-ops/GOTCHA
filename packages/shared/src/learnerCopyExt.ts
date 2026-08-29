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
    noSegments: string;
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
    you: string;
    wordMeaning: string;
    editingMessage: string;
    replyTo: (name: string) => string;
    deleteForEveryone: string;
    deleteConfirm: string;
    chatTipTitle: string;
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
    noSegments: 'No content segments available',
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
    days: (n) => `${n} days`,
    trySample: 'Try sample',
    newBadge: 'New',
    percentRead: (n) => `${n}% read`,
    percentKnown: (n) => `${n}% known`,
    resume: 'Resume',
    yourLibraryEmpty: 'Your library is empty',
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
    paidImportsHint: 'Paid imports use page-tier prices from Admin (UZS) via Atmos. Free daily/page allowances from Import & Pricing apply first.',
    freeImportsHint: 'Imports are free right now — paid imports via Atmos are currently disabled. Admin free limits apply as soon as payments are enabled.',
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
    you: 'You',
    wordMeaning: 'Word Meaning',
    editingMessage: 'Editing message',
    replyTo: (name) => `Reply to ${name}`,
    deleteForEveryone: 'Delete this message for everyone?',
    deleteConfirm: 'Delete this message?',
    chatTipTitle: 'Tap a word, or hold and drag a phrase',
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
    success: 'Success',
    new: 'New',
    days: 'days',
    minutes: 'minutes',
    hours: 'hours',
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
    noSegments: 'Нет доступных фрагментов',
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
    paidImportsHint: 'Платный импорт по тарифам страниц (UZS) через Atmos. Сначала применяются бесплатные лимиты.',
    freeImportsHint: 'Импорт сейчас бесплатен — платный через Atmos отключён. Лимиты админа действуют при включении оплаты.',
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
    you: 'Вы',
    wordMeaning: 'Значение слова',
    editingMessage: 'Редактирование',
    replyTo: (name) => `Ответ ${name}`,
    deleteForEveryone: 'Удалить для всех?',
    deleteConfirm: 'Удалить сообщение?',
    chatTipTitle: 'Нажмите на слово или выделите фразу',
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
    wordCountSummary: (total, learning, mastered) => `${total} слов · ${learning} изучаю · ${mastered} освоено`,
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
    booksRead: (count) => `${count} книг${count === 1 ? 'а' : count < 5 ? 'и' : ''} прочитано`,
    booksReadFinished: (count, finished) =>
      `${count} книг прочитано · ${finished} завершено`,
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
    checkEmailBody: 'Agar hisob mavjud bo‘lsa, tiklash havolasi yuborildi. 1 soat amal qiladi.',
    openEmailApp: 'Pochta ilovasini ochish',
    resendEmail: 'Qayta yuborish',
    didntReceive: 'Kelmadi?',
    useDifferentEmail: 'Boshqa email',
    enterEmail: 'Email kiriting',
    resetLinkSent: 'Pochtada tiklash havolasini tekshiring',
    resetLinkResent: 'Xat qayta yuborildi',
    couldNotSendReset: 'Havola yuborilmadi',
    couldNotResend: 'Qayta yuborib bo‘lmadi',
    openInboxHint: (email) => `${email || 'pochta'} qutisini oching va havolani bosing.`,
    verifyTitle: 'Emailni tasdiqlang',
    verifySuccessTitle: 'Email tasdiqlandi',
    verifyErrorTitle: 'Havola muddati tugagan',
    verifyingTitle: 'Tekshirilmoqda…',
    verifySuccessBody: 'Email tasdiqlandi. O‘qishni boshlash uchun kiring.',
    verifySuccessAdminBody: 'Email tasdiqlandi. Admin konsoliga qaytish uchun kiring.',
    verifyErrorBody: 'Havola noto‘g‘ri yoki muddati tugagan. Yangisini so‘rang.',
    verifyingBody: 'Emailingiz tasdiqlanmoqda…',
    verifySentBody: 'Tasdiqlash havolasi emailingizga yuborildi. Hisobni tasdiqlash uchun bosing.',
    verifySentAdminBody: 'Havola yuborildi. Emailni tasdiqlang, keyin admin konsoliga kiring.',
    confirmEmail: 'Email tasdiqlanmoqda…',
    resendVerification: 'Tasdiqlash xatini qayta yuborish',
    alreadyVerified: 'Allaqachon tasdiqlanganmi?',
    verifiedToast: 'Email tasdiqlandi — kira olasiz',
    enterRegisteredEmail: 'Ro‘yxatdan o‘tgan emailingizni kiriting',
    verificationSent: 'Tasdiqlash xati yuborildi',
    openAppTitle: 'GOTCHA ilovasi ochilmoqda',
    openAppBody: 'Emailni ilovada tasdiqlang. Ochilmasa, quyidagi tugmani bosing.',
    openGotchaApp: 'GOTCHA ilovasini ochish',
    continueOnWeb: 'Vebda davom etish',
    resetChooseTitle: 'Yangi parol',
    resetChooseSubtitle: 'GOTCHA uchun yangi parol. Kamida 8 belgi.',
    resetConfirmPlaceholder: 'Parolni takrorlang',
    resetUpdatedTitle: 'Parol yangilandi',
    resetUpdatedBody: 'Parol o‘zgartirildi. Yangi parol bilan kiring.',
    resetUpdatedAdminBody: 'Parol o‘zgartirildi. Admin konsoliga qaytish uchun kiring.',
    linkInvalidTitle: 'Havola noto‘g‘ri',
    linkInvalidBody: 'Havola yo‘q yoki to‘liq emas. Parolni tiklash sahifasidan yangisini so‘rang.',
    resetLinkMissing: 'Tiklash havolasi noto‘g‘ri',
    resetSuccessToast: 'Parol yangilandi — kira olasiz',
    couldNotReset: 'Parolni tiklab bo‘lmadi',
    saving: 'Saqlanmoqda…',
  },
  reader: {
    dictionary: 'Lug‘at',
    lookingUp: 'Qidirilmoqda…',
    naturalMeaning: 'Ma’no',
    translation: 'Tarjima',
    save: 'Saqlash',
    known: 'Ma’lum',
    ignore: 'E’tiborsiz',
    contentNotFound: 'Kontent topilmadi',
    noSegments: 'Bo‘limlar mavjud emas',
    backToLibrary: 'Kutubxona',
    unknown: 'noma’lum',
    learning: 'o‘rganilmoqda',
    unknownOnly: 'Faqat noma’lum',
    practice: 'Mashq',
    chapters: 'Boblar',
    collapse: 'Yig‘ish',
    page: (n) => `${n}-sahifa`,
    content: 'Kontent',
    trialBanner: (price) => `Bepul namuna. Qolganini ${price} ga oching.`,
    previous: 'Oldingi',
    next: 'Keyingi',
    unlockFullBook: 'To‘liq kitobni ochish',
    finish: 'Tugatish',
    readingComplete: 'O‘qish tugadi!',
    markedAs: (status) => `${status} deb belgilandi`,
    savedToVocab: 'lug‘atga saqlandi',
    lookupError: 'So‘z topilmadi',
    pronounceWord: 'So‘zni talaffuz qilish',
    zoomOut: 'Kichiklashtirish',
    zoomIn: 'Kattalashtirish',
    unknownOnlyTitle: 'Faqat noma’lum so‘zlar',
    practiceTitle: 'Bu bob bo‘yicha test',
    goToPage: 'Bobdagi sahifaga o‘tish',
    keepReadingSample: 'Namunani o‘qishda davom etish',
  },
  libraryPage: {
    goodMorning: 'Xayrli tong',
    goodAfternoon: 'Xayrli kun',
    goodEvening: 'Xayrli kech',
    browseTitle: 'Kutubxonani ko‘rish',
    streak: 'Seriya',
    words: 'So‘zlar',
    days: (n) => `${n} kun`,
    trySample: 'Namuna',
    newBadge: 'Yangi',
    percentRead: (n) => `${n}% o‘qilgan`,
    percentKnown: (n) => `${n}% ma’lum`,
    resume: 'Davom etish',
    yourLibraryEmpty: 'Kutubxona bo‘sh',
    noContentFound: 'Kontent topilmadi',
    newInLibrary: 'Kutubxonada yangi',
    yourImports: 'Importlaringiz',
    continueReading: 'O‘qishni davom ettirish',
    recommended: 'Sizga tavsiya',
    streakStartToday: (minutes) => `Seriyani boshlash uchun bugun ${minutes} daqiqa o‘qing.`,
    streakDayOne: '1-kun — ertaga ham davom eting!',
    streakKeepAlive: 'Seriyani saqlab qoling — ajoyib ketmoqdasiz!',
    newMaterialLabel: 'Yangi material',
    newMaterialHint: 'Kutubxona bosh sahifasida — o‘qish yoki sotib olish uchun oching.',
    learnerFallback: 'O‘quvchi',
  },
  importPage: {
    pageTitle: 'Kontent import',
    pageSubtitle: 'O‘z matn, maqola va hujjatlaringizni qo‘shing.',
    statusReady: 'Tayyor',
    statusProcessing: 'Ishlanmoqda',
    statusQueued: 'Navbatda',
    statusFailed: 'Xato',
    language: 'Til',
    titleOptional: 'Sarlavha (ixtiyoriy)',
    importFromUrl: 'URL dan import',
    importText: 'Matn import',
    uploadFile: 'Fayl yuklash',
    pastePlaceholder: 'Matnni shu yerga qo‘ying…',
    wordsNeeded: 'so‘z yetishmaydi',
    onlyPdfEpub: 'Faqat PDF va EPUB qo‘llab-quvvatlanadi',
    dropFile: 'PDF yoki ePub tashlang',
    importHistory: 'Import tarixi',
    read: 'O‘qish',
    delete: 'O‘chirish',
    previous: 'Oldingi',
    next: 'Keyingi',
    enterCardDetails: 'Karta ma’lumotlari',
    enterSmsCode: 'SMS-kod',
    purchaseFor: (amount) => `${amount} ga sotib olish`,
    confirmPayment: 'To‘lovni tasdiqlash',
    resendCode: 'Kodni qayta yuborish',
    importReady: 'Import o‘qishga tayyor',
    importLimitReached: 'Import limiti tugadi',
    deleteImport: 'Importni o‘chirish',
    deleteConfirm: 'Bu import butunlay o‘chirilsinmi?',
    titleLabel: 'Sarlavha',
    textLabel: 'Matn',
    titlePlaceholder: 'Mening matnim',
    autoFromPage: 'Sahifadan avtomatik',
    autoFromFilename: 'Fayl nomidan avtomatik',
    urlHelp: 'Gutenberg, Wikipedia, ochiq maqolalar va .txt URL lar bilan ishlaydi. Romanlar boblar bo‘linadi. Pullik sahifalar xato beradi.',
    textTooLong: (maxChars) => `Matn ${maxChars.toLocaleString()} belgidan oshdi. Bir nechta importga bo‘ling.`,
    freeAllowanceCovered: 'Bepul import limiti qoplab beradi.',
    lengthNotPriced: 'Bu uzunlik hali baholanmagan. Qisqaroq hujjat yoki keyinroq urinib ko‘ring.',
    allowanceReachedPaid: 'Import limiti tugadi. Eski importni o‘chiring yoki Atmos orqali to‘lang.',
    allowanceReachedFree: 'Import limiti tugadi. Eski importni o‘chiring — pullik import hozir yo‘q.',
    paidImportsHint: 'Pullik import Admin tariflari (UZS) bo‘yicha Atmos orqali. Avval bepul limitlar qo‘llaniladi.',
    freeImportsHint: 'Import hozir bepul — Atmos orqali pullik import o‘chirilgan. To‘lov yoqilganda admin limitlari qo‘llanadi.',
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
    recentChats: 'SO‘NGGI SUHBATLAR',
    noConversationsHint: 'Hali suhbat yo‘q. Boshqa o‘quvchilar bilan suhbat boshlang!',
    yesterday: 'Kecha',
    typing: 'yozmoqda…',
    online: 'onlayn',
    lastSeen: (time) => `${time} oldin ko‘rilgan`,
    selectConversation: 'Suhbat tanlang',
    loadingConversation: 'Yuklanmoqda…',
    chatTip: 'Maslahat: xabardagi so‘zni bosib tarjima oling.',
    reply: 'Javob',
    edit: 'Tahrirlash',
    delete: 'O‘chirish',
    messageDeleted: 'Xabar o‘chirildi',
    you: 'Siz',
    wordMeaning: 'So‘z ma’nosi',
    editingMessage: 'Xabar tahrirlanmoqda',
    replyTo: (name) => `${name} ga javob`,
    deleteForEveryone: 'Hammaga o‘chirilsinmi?',
    deleteConfirm: 'Xabar o‘chirilsinmi?',
    chatTipTitle: 'So‘zni bosing yoki iborani belgilab ushlab turing',
  },
  practicePage: {
    practiceWhatYouRead: 'O‘qiganingizni mashq qiling',
    goToLibrary: 'Kutubxonaga',
    comprehension: 'Tushunish',
    fillBlank: 'Bo‘sh joy',
    shortAnswer: 'Qisqa javob',
    quizYourself: 'O‘zingizni sinang',
    generatingQuiz: 'Test yaratilmoqda…',
    typeAnswer: 'Javob yozing…',
    nextQuestion: 'Keyingi savol',
    finishQuiz: 'Testni tugatish',
    submitting: 'Yuborilmoqda…',
    greatWork: 'Ajoyib — davom eting!',
    tryAnother: 'Yana test',
    backToReading: 'O‘qishga qaytish',
    openChapterFirst: 'Avval o‘qishda bob oching',
    pickAnswer: 'Javob tanlang',
    readerHint: 'O‘qishda bob oching va shu parcha bo‘yicha mashq uchun «Mashq» ni bosing.',
  },
  paywall: {
    unlockBook: 'Kitobni bir marta to‘lab kutubxonada oching.',
    congratulations: 'Tabriklaymiz!',
    startReading: 'O‘qishni boshlash',
    failedPayment: 'To‘lovni boshlab bo‘lmadi',
    cardVerificationFailed: 'Karta tekshiruvi xato',
    unlockFor: (amount) => `${amount} ga ochish`,
    paymentNotStartedBook: 'Bu kitob uchun to‘lovni boshlab bo‘lmadi.',
  },
  importReturn: {
    confirming: 'To‘lov tasdiqlanmoqda…',
    waitingAtmos: 'Atmos tasdiqlashi kutilmoqda…',
    missingReference: 'To‘lov havolasi yo‘q',
    paymentConfirmed: 'To‘lov tasdiqlandi. Importni yakunlang.',
    importReady: 'Import tayyor',
    reselectFile: 'To‘lov qabul qilindi. Importni yakunlash uchun PDF/EPUB ni qayta tanlang.',
    paymentNotConfirmedToast: 'To‘lov hali tasdiqlanmadi. Pul yechilgan bo‘lsa, Importni ochib qayta urinib ko‘ring.',
    importing: 'To‘lov tasdiqlandi — import qilinmoqda…',
    importSubmitted: 'Import yuborildi',
    couldNotFinishImport: 'To‘lovdan keyin importni yakunlab bo‘lmadi',
  },
  peerProfile: {
    title: 'Profil',
    loading: 'Yuklanmoqda…',
    message: (name) => `${name} ga yozish`,
    memberSince: (date) => `${date} dan a’zo`,
    booksRead: 'O‘qilgan kitoblar',
    wordsLearned: 'O‘rganilgan so‘zlar',
    chats: 'Suhbatlar',
    languages: 'Tillar',
    native: 'Ona tili',
    currentlyReading: 'Hozir o‘qimoqda',
    percentRead: (n) => `${n}% o‘qilgan`,
    proficient: 'Yuqori',
    intermediate: 'O‘rta',
    basic: 'Boshlang‘ich',
  },
  languageInput: {
    searchPlaceholder: 'Til qidirish...',
    addAnother: 'Yana qo‘shish…',
    noMatch: 'Til topilmadi',
    remove: (name) => `${name} ni olib tashlash`,
  },
  statsPage: {
    last7Days: '7 kun',
    last30Days: '30 kun',
    currentStreak: 'Joriy seriya',
    readingTime: 'O‘qish vaqti',
    vocabularyBreakdown: 'Lug‘at tahlili',
    booksRead: 'O‘qilgan kitoblar',
    noDataYet: 'Hali ma’lumot yo‘q',
    minutesRead: 'O‘qilgan daqiqalar',
    wordsAdded: 'Qo‘shilgan so‘zlar',
    dailyAverage: 'Kunlik o‘rtacha',
  },
  billing: {
    today: 'bugun',
    thisMonth: 'bu oy',
    thisYear: 'bu yil',
    importsFree: 'Import hozir bepul (to‘lov to‘xtatilgan).',
    freeImportsLeft: (remaining, total, cycle) => `${cycle} ${total} dan ${remaining} bepul import qoldi`,
    freePagesLeft: (remaining, total, cycle) => `${cycle} ${total} dan ${remaining} bepul sahifa qoldi`,
    configuredPool: (dailyImports, pageLimit, cycle) =>
      `Limit: kuniga ${dailyImports} import · ${pageLimit} sahifa ${cycle}.`,
  },
  commonExt: {
    delete: 'O‘chirish',
    read: 'O‘qish',
    previous: 'Oldingi',
    next: 'Keyingi',
    close: 'Yopish',
    confirm: 'Tasdiqlash',
    retry: 'Qayta urinish',
    error: 'Xato',
    success: 'Muvaffaqiyat',
    new: 'Yangi',
    days: 'kun',
    minutes: 'daq.',
    hours: 'soat',
    yesterday: 'Kecha',
    today: 'Bugun',
  },
  vocabPage: {
    pageSubtitle: 'O‘qish paytida shaxsiy so‘zlar ro‘yxatini yarating',
    loading: 'Lug‘at yuklanmoqda…',
    loadErrorTitle: 'Lug‘atni yuklab bo‘lmadi',
    searchPlaceholder: 'So‘zlarni qidirish…',
    total: 'Jami',
    due: 'Muddat',
    mastery: 'O‘zlashtirish',
    word: 'So‘z',
    translation: 'Tarjima',
    status: 'Holat',
    next: 'Keyingi',
    interval: 'Interval',
    reps: 'Takror',
    actions: 'Amallar',
    dueForReview: 'Takror uchun',
    markKnown: 'Ma’lum deb belgilash',
    remove: 'Olib tashlash',
    noMatchSearch: 'Qidiruvga mos so‘z yo‘q',
    reviewDue: (count) => `${count} ta takror`,
    wordCountSummary: (total, learning, mastered) => `${total} so‘z · ${learning} o‘rganilmoqda · ${mastered} o‘zlashtirilgan`,
    ratedAs: (lemma, rating) => `«${lemma}» — ${rating}`,
    filterAll: 'hammasi',
    filterDue: (count) => `Muddat (${count})`,
    filterLearning: 'o‘rganilmoqda',
    filterKnown: 'o‘zlashtirilgan',
    overdue: (days) => `${days} kun kechikdi`,
    tomorrow: 'Ertaga',
    inDays: (days) => `${days} kundan keyin`,
    statusLearning: 'o‘rganilmoqda',
    statusKnown: 'o‘zlashtirilgan',
  },
  notificationsPage: {
    filterAll: (count) => `Hammasi (${count})`,
    filterUnread: (count) => `O‘qilmagan (${count})`,
    filterLibrary: (count) => `Kutubxona (${count})`,
    filterSystem: (count) => `Tizim (${count})`,
    emptyUnread: 'O‘qilmagan bildirishnoma yo‘q',
    emptyLibrary: 'Yangi kutubxona xabarlari yo‘q',
    catalogHint: 'Katalogdagi yangi kitoblar nashr qilinganda shu yerda ko‘rinadi.',
    justNow: 'hozirgina',
    minutesAgo: (mins) => `${mins} daq oldin`,
    hoursAgo: (hours) => `${hours} soat oldin`,
    daysAgo: (days) => `${days} kun oldin`,
  },
  charts: {
    noActivityInRange: 'Bu davrda faoliyat yo‘q',
    noWordSavesYet: 'Hali saqlangan so‘z yo‘q',
    noWordsInRange: 'Bu davrda saqlangan so‘z yo‘q',
    noBooksRead: 'O‘qilgan kitob yo‘q',
    booksRead: (count) => `${count} kitob o‘qilgan`,
    booksReadFinished: (count, finished) => `${count} kitob o‘qilgan · ${finished} tugatilgan`,
  },
  errors: {
    lookupFailed: 'Qidiruv muvaffaqiyatsiz',
    saveFailed: 'Saqlab bo‘lmadi',
    updateFailed: 'Yangilab bo‘lmadi',
    reviewFailed: 'Takror muvaffaqiyatsiz',
    importFailed: 'Import muvaffaqiyatsiz',
    uploadFailed: 'Yuklab bo‘lmadi',
    registrationFailed: 'Ro‘yxatdan o‘tish muvaffaqiyatsiz',
    failedLoadVocab: 'Lug‘atni yuklab bo‘lmadi',
    requestFailed: 'So‘rov muvaffaqiyatsiz',
    failedStartPayment: 'To‘lovni boshlab bo‘lmadi',
    cardVerificationFailed: 'Karta tekshiruvi xato',
    unexpectedPaymentState: 'Karta tekshiruvidan keyin kutilmagan holat.',
    paymentNotConfirmedOtp: 'To‘lov tasdiqlanmadi. SMS-kodni tekshiring.',
    paymentNotConfirmedCard: 'To‘lov tasdiqlanmadi. Boshqa kartadan urinib ko‘ring.',
    couldNotResendOtp: 'Kodni qayta yuborib bo‘lmadi',
    otpVerificationFailed: 'OTP tekshiruvi xato',
    couldNotDeleteImport: 'Importni o‘chirib bo‘lmadi',
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
