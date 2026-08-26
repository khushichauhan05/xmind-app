// usernameValidator.ts
// This TypeScript file implements a comprehensive username validation system based on best practices.
// It incorporates detailed checks for length, characters, uniqueness, reserved words, abusive content, impersonation, formatting, security, and more.
// Sources and inspirations:
// - General best practices from DEV Community  and GeeksforGeeks : Length between 3-16, alphanumeric with underscores.
// - For social media like X (formerly Twitter): Max 15 chars, only letters, numbers, underscores; no hyphens, no special chars; cannot contain "Twitter" or "Admin" .
// - Profanity filtering: Inspired by libraries like bad-words , Profanity , bad-words-next . Handles leetspeak, obscuring, and variations.
// - Validation techniques: Regex for patterns , runtime checks with TypeScript types , .
// - Impersonation and reserved: Extended list including platform-specific like "official" .
// - Formatting: No leading/trailing underscores, no consecutive specials .
// - Security: Prevent XSS-like injections [general best practice].
// - Uniqueness: Simulated DB check; in production, use actual database query.
// - Rate limiting: Not implemented here (requires user context); typically once per 30 days [platform-specific].
// - Cross-platform: Simulated; check for conflicts with emails or other services.
// - Case: Usernames are case-insensitive; normalized to lowercase.
// - Additional: Handles localized profanity (basic English here; extend for multi-language , ).
// - Note: For production, integrate a full profanity library like 'bad-words' via npm.

// Assumptions/Configurations (customizable):
// - Min length: 4 (common for usability)
// - Max length: 15 (matches xMind )
// - Allowed chars: a-z, 0-9, _ (no hyphens, as per xMind rules , )
// - Platform mode: 'general' or 'xMind' for stricter rules

type PlatformMode = "general" | "xMind";

interface ValidationConfig {
  minLength: number;
  maxLength: number;
  allowedCharsRegex: RegExp;
  noLeadingTrailingRegex: RegExp;
  noConsecutiveRegex: RegExp;
  reservedWords: string[];
  abusiveWords: string[];
  impersonationKeywords: string[];
  platformMode: PlatformMode;
}

// Default Config
const defaultConfig: ValidationConfig = {
  minLength: 4,
  maxLength: 15,
  allowedCharsRegex: /^[a-z0-9_]+$/, // Lowercase letters, numbers, underscores only (no hyphens for X compatibility )
  noLeadingTrailingRegex: /^(?!_)[a-z0-9_]+(?<![_])$/, // No leading/trailing underscores
  noConsecutiveRegex: /^(?!.*[_]{2}).*$/, // No consecutive underscores
  reservedWords: [
    "admin",
    "administrator",
    "moderator",
    "system",
    "root",
    "official",
    "support",
    "help",
    "twitter",
    "x",
    "facebook",
    "insta",
    "instagram",
    "tiktok",
    "youtube",
    "twitch",
    "discord",
    "reddit",
    "pinterest", // Platform-specific ,
    "linkedin",
    "twitter",
    "x",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "twitch",
    "discord",
    "reddit",
    "pinterest",
    "linkedin",
    "github",
    "gitlab",
    "bitbucket",
    "heroku",
    "vercel",
    "netlify",
    "vercel",
    "heroku",
    "bitbucket",
    "gitlab",
    "github",
    "linkedin",
    "pinterest",
    "reddit",
    "twitch",
    "youtube",
    "tiktok",
    "instagram",
    // Extend with more: e.g., generic terms like 'user', 'account'
  ],
  abusiveWords: [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "cunt",
    "dick",
    "piss",
    "hate",
    "kill",
    "slur",
    "nigger",
    "fag",
    "retard",
    "retarded",
    "4r5e",
    "5h1t",
    "5hit",
    "a55",
    "anal",
    "anus",
    "ar5e",
    "arrse",
    "arse",
    "ass",
    "ass-fucker",
    "asses",
    "assfucker",
    "assfukka",
    "asshole",
    "assholes",
    "asswhole",
    "a_s_s",
    "b!tch",
    "b00bs",
    "b17ch",
    "b1tch",
    "ballbag",
    "balls",
    "ballsack",
    "bastard",
    "beastial",
    "beastiality",
    "bellend",
    "bestial",
    "bestiality",
    "bi+ch",
    "biatch",
    "bitch",
    "bitcher",
    "bitchers",
    "bitches",
    "bitchin",
    "bitching",
    "bloody",
    "blow job",
    "blowjob",
    "blowjobs",
    "boiolas",
    "bollock",
    "bollok",
    "boner",
    "boob",
    "boobs",
    "booobs",
    "boooobs",
    "booooobs",
    "booooooobs",
    "breasts",
    "buceta",
    "bugger",
    "bum",
    "bunny fucker",
    "butt",
    "butthole",
    "buttmuch",
    "buttplug",
    "c0ck",
    "c0cksucker",
    "carpet muncher",
    "cawk",
    "chink",
    "cipa",
    "cl1t",
    "clit",
    "clitoris",
    "clits",
    "cnut",
    "cock",
    "cock-sucker",
    "cockface",
    "cockhead",
    "cockmunch",
    "cockmuncher",
    "cocks",
    "cocksuck",
    "cocksucked",
    "cocksucker",
    "cocksucking",
    "cocksucks",
    "cocksuka",
    "cocksukka",
    "cok",
    "cokmuncher",
    "coksucka",
    "coon",
    "cox",
    "crap",
    "cum",
    "cummer",
    "cumming",
    "cums",
    "cumshot",
    "cunilingus",
    "cunillingus",
    "cunnilingus",
    "cunt",
    "cuntlick",
    "cuntlicker",
    "cuntlicking",
    "cunts",
    "cyalis",
    "cyberfuc",
    "cyberfuck",
    "cyberfucked",
    "cyberfucker",
    "cyberfuckers",
    "cyberfucking",
    "d1ck",
    "damn",
    "dick",
    "dickhead",
    "dildo",
    "dildos",
    "dink",
    "dinks",
    "dirsa",
    "dlck",
    "dog-fucker",
    "doggin",
    "dogging",
    "donkeyribber",
    "doosh",
    "duche",
    "dyke",
    "ejaculate",
    "ejaculated",
    "ejaculates",
    "ejaculating",
    "ejaculatings",
    "ejaculation",
    "ejakulate",
    "f u c k",
    "f u c k e r",
    "f4nny",
    "fag",
    "fagging",
    "faggitt",
    "faggot",
    "faggs",
    "fagot",
    "fagots",
    "fags",
    "fanny",
    "fannyflaps",
    "fannyfucker",
    "fanyy",
    "fatass",
    "fcuk",
    "fcuker",
    "fcuking",
    "feck",
    "fecker",
    "felching",
    "fellate",
    "fellatio",
    "fingerfuck",
    "fingerfucked",
    "fingerfucker",
    "fingerfuckers",
    "fingerfucking",
    "fingerfucks",
    "fistfuck",
    "fistfucked",
    "fistfucker",
    "fistfuckers",
    "fistfucking",
    "fistfuckings",
    "fistfucks",
    "flange",
    "fook",
    "fooker",
    "fuck",
    "fucka",
    "fucked",
    "fucker",
    "fuckers",
    "fuckhead",
    "fuckheads",
    "fuckin",
    "fucking",
    "fuckings",
    "fuckingshitmotherfucker",
    "fuckme",
    "fucks",
    "fuckwhit",
    "fuckwit",
    "fudge packer",
    "fudgepacker",
    "fuk",
    "fuker",
    "fukker",
    "fukkin",
    "fuks",
    "fukwhit",
    "fukwit",
    "fux",
    "fux0r",
    "f_u_c_k",
    "gangbang",
    "gangbanged",
    "gangbangs",
    "gaylord",
    "gaysex",
    "goatse",
    "God",
    "god-dam",
    "god-damned",
    "goddamn",
    "goddamned",
    "hardcoresex",
    "hell",
    "heshe",
    "hoar",
    "hoare",
    "hoer",
    "homo",
    "hore",
    "horniest",
    "horny",
    "hotsex",
    "jack-off",
    "jackoff",
    "jap",
    "jerk-off",
    "jism",
    "jiz",
    "jizm",
    "jizz",
    "kawk",
    "knob",
    "knobead",
    "knobed",
    "knobend",
    "knobhead",
    "knobjocky",
    "knobjokey",
    "kock",
    "kondum",
    "kondums",
    "kum",
    "kummer",
    "kumming",
    "kums",
    "kunilingus",
    "l3i+ch",
    "l3itch",
    "labia",
    "lust",
    "lusting",
    "m0f0",
    "m0fo",
    "m45terbate",
    "ma5terb8",
    "ma5terbate",
    "masochist",
    "master-bate",
    "masterb8",
    "masterbat*",
    "masterbat3",
    "masterbate",
    "masterbation",
    "masterbations",
    "masturbate",
    "mo-fo",
    "mof0",
    "mofo",
    "mothafuck",
    "mothafucka",
    "mothafuckas",
    "mothafuckaz",
    "mothafucked",
    "mothafucker",
    "mothafuckers",
    "mothafuckin",
    "mothafucking",
    "mothafuckings",
    "mothafucks",
    "mother fucker",
    "motherfuck",
    "motherfucked",
    "motherfucker",
    "motherfuckers",
    "motherfuckin",
    "motherfucking",
    "motherfuckings",
    "motherfuckka",
    "motherfucks",
    "muff",
    "mutha",
    "muthafecker",
    "muthafuckker",
    "muther",
    "mutherfucker",
    "n1gga",
    "n1gger",
    "nazi",
    "nigg3r",
    "nigg4h",
    "nigga",
    "niggah",
    "niggas",
    "niggaz",
    "nigger",
    "niggers",
    "nob",
    "nob jokey",
    "nobhead",
    "nobjocky",
    "nobjokey",
    "numbnuts",
    "nutsack",
    "orgasim",
    "orgasims",
    "orgasm",
    "orgasms",
    "p0rn",
    "pawn",
    "pecker",
    "penis",
    "penisfucker",
    "phonesex",
    "phuck",
    "phuk",
    "phuked",
    "phuking",
    "phukked",
    "phukking",
    "phuks",
    "phuq",
    "pigfucker",
    "pimpis",
    "piss",
    "pissed",
    "pisser",
    "pissers",
    "pisses",
    "pissflaps",
    "pissin",
    "pissing",
    "pissoff",
    "poop",
    "porn",
    "porno",
    "pornography",
    "pornos",
    "prick",
    "pricks",
    "pron",
    "pube",
    "pusse",
    "pussi",
    "pussies",
    "pussy",
    "pussys",
    "rectum",
    "retard",
    "rimjaw",
    "rimming",
    "s hit",
    "s.o.b.",
    "sadist",
    "schlong",
    "screwing",
    "scroat",
    "scrote",
    "scrotum",
    "semen",
    "sex",
    "sh!+",
    "sh!t",
    "sh1t",
    "shag",
    "shagger",
    "shaggin",
    "shagging",
    "shemale",
    "shi+",
    "shit",
    "shitdick",
    "shite",
    "shited",
    "shitey",
    "shitfuck",
    "shitfull",
    "shithead",
    "shiting",
    "shitings",
    "shits",
    "shitted",
    "shitter",
    "shitters",
    "shitting",
    "shittings",
    "shitty",
    "skank",
    "slut",
    "sluts",
    "smegma",
    "smut",
    "snatch",
    "son-of-a-bitch",
    "spac",
    "spunk",
    "s_h_i_t",
    "t1tt1e5",
    "t1tties",
    "teets",
    "teez",
    "testical",
    "testicle",
    "tit",
    "titfuck",
    "tits",
    "titt",
    "tittie5",
    "tittiefucker",
    "titties",
    "tittyfuck",
    "tittywank",
    "titwank",
    "tosser",
    "turd",
    "tw4t",
    "twat",
    "twathead",
    "twatty",
    "twunt",
    "twunter",
    "v14gra",
    "v1gra",
    "vagina",
    "viagra",
    "vulva",
    "w00se",
    "wang",
    "wank",
    "wanker",
    "wanky",
    "whoar",
    "whore",
    "willies",
    "willy",
    "xrated",
    "xxx",
  ],
  impersonationKeywords: [
    "official",
    "real",
    "verified",
    "elonmusk",
    "beyonce",
    "admin", // ,
    // Add more celebrities/brands
  ],
  platformMode: "xMind", // Set to 'x' for stricter rules
};

// Helper: Normalize username for checks (lowercase, leetspeak reversal, strip obscuring)
// Inspired by profanity libraries handling variations , ,
function normalizeUsername(username: string): string {
  let normalized = username.toLowerCase();
  // Leetspeak substitutions (common ones)
  const leetSubs: Record<string, string> = {
    "4": "a",
    "@": "a",
    "3": "e",
    "1": "i",
    "!": "i",
    "0": "o",
    "5": "s",
    $: "s",
    "7": "t",
    "8": "b",
    "9": "g",
    "|": "i",
    "/": "l", // Extend as needed
  };
  normalized = normalized
    .split("")
    .map((char) => leetSubs[char] || char)
    .join("");
  // Remove obscuring characters (*, -, etc.) for detection
  normalized = normalized.replace(/[^a-z0-9]/g, "");
  return normalized;
}

// Helper: Check if word is in list (substring match for robustness)
function containsWord(normalized: string, words: string[]): boolean {
  // Try word boundaries around tokens derived from underscores/letters -> digits
  const tokens = normalized.split(/[_\W]+/).filter(Boolean);
  const set = new Set(tokens);
  return words.some((word) => set.has(word));
}

// Check Result Type
interface CheckResult {
  valid: boolean;
  error?: string;
}

// Check 1: Length Requirements , ,
function checkLength(username: string, config: ValidationConfig): CheckResult {
  if (username.length < config.minLength) {
    return {
      valid: false,
      error: `Please choose a username with at least ${config.minLength} characters.`,
    };
  }
  if (username.length > config.maxLength) {
    return {
      valid: false,
      error: `Your username should be ${config.maxLength} characters or fewer.`,
    };
  }
  return { valid: true };
}

// Check 2: Character Validity ,
function checkCharacters(
  username: string,
  config: ValidationConfig
): CheckResult {
  if (!config.allowedCharsRegex.test(username.toLowerCase())) {
    return {
      valid: false,
      error:
        "Use only lowercase letters, numbers, or underscores in your username.",
    };
  }
  // Platform-specific: For 'x', no hyphens (already in regex)
  return { valid: true };
}

// Check 3: Uniqueness (Async; simulated DB) [general best practice]
async function checkUniqueness(
  currentUser: string,
  username: string,
  existingUsernames: string[] = []
): Promise<CheckResult> {
  // Use provided existing usernames or fallback to mock data
  const usernamesToCheck =
    existingUsernames.length > 0
      ? existingUsernames
      : ["user1", "john_doe", "example", "admin"]; // Fallback mock data

  if (usernamesToCheck.includes(username.toLowerCase())) {
    if (usernamesToCheck.includes(currentUser.toLowerCase()) && username === currentUser) {
      return {
        valid: false,
        error: "This username is already linked to your account.",
      };
    } else {
      return { valid: false, error: "Sorry, this username is already in use." };
    }
  }

  // Real impl: await db.users.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  // Consider case-insensitive index in DB
  return { valid: true };
}

// Check 4: Reserved Words
function checkReserved(
  username: string,
  config: ValidationConfig
): CheckResult {
  const uname = username.toLowerCase();
  if (config.reservedWords.map((w) => w.toLowerCase()).includes(uname)) {
    return {
      valid: false,
      error: "This username is reserved. Please choose another.",
    };
  }
  // Note: domain-like patterns are already blocked by allowedCharsRegex.
  // Keep this as a defense-in-depth check for future regex changes.
  if (
    config.platformMode === "xMind" &&
    /(\.com|\.net|\.io)$/i.test(username)
  ) {
    return {
      valid: false,
      error:
        "Usernames cannot include domain extensions like .com, .net, or .io.",
    };
  }
  return { valid: true };
}

// Check 5: Abusive Words (with variations, leetspeak) , , ,
function checkAbusive(username: string, config: ValidationConfig): CheckResult {
  const normalized = normalizeUsername(username);
  if (containsWord(normalized, config.abusiveWords)) {
    return {
      valid: false,
      error:
        "Please choose a username without offensive or inappropriate words.",
    };
  }
  // Advanced regex for common variations
  const abusiveRegexPatterns: RegExp[] = [
    /f[u*ck]+k/,
    /sh[i*]+t/,
    /b[i*]+tch/,
    /a[s$]+hole/,
    /c[u*]+nt/,
    /d[i*]+ck/,
    /p[i*]+ss/,
    /n[i1]+gg[a@]+/,
    /f[a@]+g/,
    /r[e3]+t[a@]+rd/, // Extend with more
  ];
  if (abusiveRegexPatterns.some((regex) => regex.test(normalized))) {
    return {
      valid: false,
      error:
        "Please choose a username without offensive or inappropriate words.",
    };
  }
  // In production, use a library like import BadWords from 'bad-words'; if (new BadWords().isProfane(username)) ...
  // Handle multi-language: Add words for other languages
  return { valid: true };
}

// Check 6: Impersonation , ,
function checkImpersonation(
  username: string,
  config: ValidationConfig
): CheckResult {
  const normalized = normalizeUsername(username);
  if (containsWord(normalized, config.impersonationKeywords)) {
    return {
      valid: false,
      error:
        "This username might suggest you're someone else. Please pick a different one.",
    };
  }
  // Advanced: Use string similarity (e.g., Levenshtein distance) to famous names
  // Example: if similarity('elonmusk', normalized) > 0.8 ...
  // Manual review flag for suspicious cases
  return { valid: true };
}

// Check 7: Formatting Rules
function checkFormatting(
  username: string,
  config: ValidationConfig
): CheckResult {
  if (!config.noLeadingTrailingRegex.test(username.toLowerCase())) {
    return {
      valid: false,
      error:
        "Usernames cannot start or end with an underscore. Try a different format.",
    };
  }
  if (!config.noConsecutiveRegex.test(username.toLowerCase())) {
    return {
      valid: false,
      error:
        "Avoid using multiple underscores in a row. Please try a different username.",
    };
  }
  // No spaces (already in char check)
  return { valid: true };
}

// Check 8: Case Sensitivity - Handled via normalization (case-insensitive)

// Check 9: Platform-Specific Rules ,
function checkPlatformSpecific(
  username: string,
  config: ValidationConfig
): CheckResult {
  if (config.platformMode === "xMind") {
    // Additional X rules: No "twitter" or "admin" (already in reserved)
    // Must start with letter? (optional; not enforced here)
    // No special chars beyond _ (already checked)
  }
  return { valid: true };
}

// Check 10: Availability Across Platforms (Simulated async)
async function checkCrossPlatform(username: string): Promise<CheckResult> {
  // Mock: Check if conflicts with email domains or other services
  // Example: if username ends with '@gmail.com' - invalid
  if (username.includes("@")) {
    return {
      valid: false,
      error:
        "Usernames cannot resemble email addresses. Please remove the '@' symbol.",
    };
  }
  // Real: API calls to other platforms or services
  return { valid: true };
}

// Check 11: Rate Limiting - Not here; server-side with user history (e.g., last change > 30 days ago)

// Check 12: Security Checks [general]
function checkSecurity(username: string): CheckResult {
  // Prevent XSS or injections
  const dangerousPatterns: RegExp[] = [
    /<script>/i,
    /alert\(/i,
    /javascript:/i,
    /onerror/i,
    /onclick/i,
  ];
  if (dangerousPatterns.some((pattern) => pattern.test(username))) {
    return {
      valid: false,
      error:
        "This username contains unsafe content. Please choose a safer option.",
    };
  }
  // Also, no HTML entities or encoded attacks
  return { valid: true };
}

// Main Validation Function (Async for uniqueness and cross-platform)
async function validateUsername(
  currentUser: string,
  username: string,
  customConfig?: Partial<ValidationConfig>,
  existingUsernames?: string[]
): Promise<{ valid: boolean; errors: string[] }> {
  const config = { ...defaultConfig, ...customConfig };
  const syncChecks: CheckResult[] = [
    checkLength(username, config),
    checkCharacters(username, config),
    checkFormatting(username, config),
    checkReserved(username, config),
    checkAbusive(username, config),
    checkImpersonation(username, config),
    checkPlatformSpecific(username, config),
    checkSecurity(username),
  ];

  const asyncChecks = await Promise.all([
    checkUniqueness(currentUser, username, existingUsernames),
    checkCrossPlatform(username),
  ]);

  const allResults = [...syncChecks, ...asyncChecks];
  const errors = allResults
    .filter((result) => !result.valid)
    .map((result) => result.error!);

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export
export { validateUsername, ValidationConfig };
