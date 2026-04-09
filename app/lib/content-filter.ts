// app/lib/content-filter.ts

export interface ContentFlag {
  flagType: 'phone' | 'email' | 'social' | 'url' | 'messaging_app'
  matchedContent: string
}

// ── Number word maps ──

const EN_NUMBERS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
}

const AL_NUMBERS: Record<string, string> = {
  zero: '0', nje: '1', dy: '2', tre: '3', kater: '4',
  pese: '5', gjashte: '6', shtate: '7', tete: '8', nente: '9',
}

// Sorted longest-first so "shtate" matches before "sh" prefix issues
const ALL_NUMBER_WORDS = Object.keys({ ...EN_NUMBERS, ...AL_NUMBERS })
  .sort((a, b) => b.length - a.length)

const NUMBER_MAP: Record<string, string> = { ...EN_NUMBERS, ...AL_NUMBERS }

// ── Letter substitutions ──
const LETTER_SUBS: Record<string, string> = {
  o: '0', O: '0', l: '1', I: '1', s: '5', S: '5', B: '8',
}

// ── Regex patterns (Layer 1) ──

const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{6,15}\d)/g
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|net|org|io|co|al|me|info|biz|app|dev)(?:\/[^\s]*)?/gi
const SOCIAL_REGEX = /@[a-zA-Z0-9_]{3,30}/g
const MESSAGING_APP_REGEX = /\b(?:whatsapp|telegram|signal|viber|messenger|instagram\s*dm|insta\s*dm)\b/gi

// ── Normalization (Layer 2) ──

function normalizeMessage(text: string): string {
  let normalized = text.toLowerCase()

  // Replace spelled-out number words with digits (longest first)
  for (const word of ALL_NUMBER_WORDS) {
    const regex = new RegExp(word, 'gi')
    normalized = normalized.replace(regex, NUMBER_MAP[word])
  }

  // Letter substitutions — only in sequences that already contain digits
  // to avoid massive false positives on normal text like "Hello Boss"
  normalized = normalized.replace(/(?:\d[oOlISsB\d\s-]*|[oOlISsB][oOlISsB\d\s-]*\d)[oOlISsB\d\s-]*/g, (match) => {
    return match.replace(/[oOlISsB]/g, (ch) => LETTER_SUBS[ch] ?? ch)
  })

  // Strip separators between single digits/chars: "0 6 9" → "069"
  normalized = normalized.replace(/(\d)\s+(?=\d)/g, '$1')

  return normalized
}

// ── Main filter function ──

export function scanMessage(content: string): ContentFlag[] {
  const flags: ContentFlag[] = []
  const seen = new Set<string>()

  function addFlag(flagType: ContentFlag['flagType'], matched: string) {
    const key = `${flagType}:${matched}`
    if (!seen.has(key)) {
      seen.add(key)
      flags.push({ flagType, matchedContent: matched })
    }
  }

  // Layer 1: Direct regex on original text
  for (const match of content.matchAll(PHONE_REGEX)) addFlag('phone', match[0])
  for (const match of content.matchAll(EMAIL_REGEX)) addFlag('email', match[0])
  for (const match of content.matchAll(URL_REGEX)) addFlag('url', match[0])
  for (const match of content.matchAll(SOCIAL_REGEX)) addFlag('social', match[0])
  for (const match of content.matchAll(MESSAGING_APP_REGEX)) addFlag('messaging_app', match[0])

  // Layer 2: Normalize then re-scan for phone/email
  const normalized = normalizeMessage(content)
  for (const match of normalized.matchAll(PHONE_REGEX)) addFlag('phone', match[0])
  for (const match of normalized.matchAll(EMAIL_REGEX)) addFlag('email', match[0])

  return flags
}
