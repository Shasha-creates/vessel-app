import {
  videos as seedVideos,
  curatedGuides,
  formatLikes,
  type Video,
  type VesselGuide,
  type ContentCategory,
  type ContentCollection,
} from './mockData'
import { aiModerator } from './aiModerator'

type Listener = () => void

const ACTIVE_USER_NAME_KEY = 'vessel_user'
const ACTIVE_USER_ID_KEY = 'vessel_user_id'
const ACTIVE_USER_CHURCH_KEY = 'vessel_user_church'
const ACTIVE_USER_COUNTRY_KEY = 'vessel_user_country'
const ACTIVE_USER_PHOTO_KEY = 'vessel_user_photo'
const ACTIVE_USER_EMAIL_KEY = 'vessel_user_email'
const ACTIVE_USER_VERIFIED_KEY = 'vessel_user_verified'
const AUTH_TOKEN_KEY = 'vessel_auth_token'
const UPLOAD_STORAGE_KEY = 'vessel_user_uploads_v1'
const FOLLOWING_STORAGE_KEY = 'vessel_following_ids_v1'
const BOOKMARK_STORAGE_KEY = 'vessel_bookmarks_v1'
const DEFAULT_VIDEO_PLACEHOLDER = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
const DEFAULT_THUMB_PLACEHOLDER = 'https://placehold.co/640x360?text=Vessel'
const NETWORK_DELAY_MIN = 220
const NETWORK_DELAY_MAX = 520
const NETWORK_FAILURE_RATE = 0.05
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])
const MODERATION_CONTEXT_PROFILE = 'profile'
const MODERATION_CONTEXT_UPLOAD = 'upload'
const DEFAULT_SAVED_IDS = ['psalm23-reflection']
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const GUEST_FOLLOW_DEFAULTS = ['sarah-grace', 'river-city-worship', 'pastor-ana'].map((id) => normalizeId(id))
let remoteFeed: Video[] = []

type StoredUpload = Omit<Video, 'videoUrl'>
type CommentableVideo = Video

type ActiveProfile = {
  id: string
  name: string
  church: string
  country: string
  email: string
  photo?: string
  isVerified: boolean
}

type ActiveProfileUpdate = {
  id?: string
  name?: string
  church?: string | null
  country?: string | null
  email?: string | null
  photo?: string | null
  isVerified?: boolean | null
}

type EmailVerificationResult = {
  valid: boolean
  message?: string
}

type ApiUser = {
  id: string
  handle: string
  name: string
  email: string
  church: string | null
  country: string | null
  photoUrl: string | null
  isVerified: boolean
}

type ContactMatch = {
  id: string
  handle: string
  name: string
  email: string
  church: string | null
  country: string | null
  photoUrl: string | null
}

type ApiFeedVideo = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  tags?: string[]
  durationSeconds?: number
  videoUrl: string
  thumbnailUrl?: string | null
  createdAt: string
  stats?: {
    likes?: number
    comments?: number
  }
  user: {
    id: string
    name?: string | null
    handle: string
    church?: string | null
    country?: string | null
    photoUrl?: string | null
  }
}

const listeners = new Set<Listener>()
let uploadsHydrated = false
let uploads: Video[] = []
let followedHydrated = false
let followedIds = new Set<string>()
let followingFetchPromise: Promise<void> | null = null
let bookmarksHydrated = false
let bookmarkedIds = new Set<string>()

type ModerationContext = 'profile' | 'upload' | 'message' | 'comment'
type ModerationFieldInput = {
  label: string
  text: string
}

function enforceModeration(context: ModerationContext, fields: ModerationFieldInput[]) {
  const sanitizedFields = fields
    .map((field) => ({ label: field.label, text: field.text.trim() }))
    .filter((field) => field.text.length > 0)

  if (!sanitizedFields.length) return

  const outcome = aiModerator.review({ context, fields: sanitizedFields })
  if (!outcome.approved) {
    const primary = outcome.issues[0]
    const reason = primary ? `${primary.reason} (${primary.field}).` : 'Content needs another pass before sharing.'
    throw new Error(reason)
  }
}

function getActiveUserId(): string {
  if (typeof window === 'undefined') return 'me'
  const existing = window.localStorage.getItem(ACTIVE_USER_ID_KEY)
  if (existing) return existing
  const generated = `user-${Math.random().toString(36).slice(2, 8)}`
  window.localStorage.setItem(ACTIVE_USER_ID_KEY, generated)
  return generated
}

function getActiveUserName(): string {
  if (typeof window === 'undefined') return 'Guest Creator'
  return window.localStorage.getItem(ACTIVE_USER_NAME_KEY) || 'Guest Creator'
}

function getActiveUserChurch(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_CHURCH_KEY) || ''
}

function getActiveUserCountry(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_COUNTRY_KEY) || ''
}

function getActiveUserVerified(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ACTIVE_USER_VERIFIED_KEY) === 'true'
}

function verifyEmailStructure(email: string): EmailVerificationResult {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { valid: false, message: 'Enter an email' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { valid: false, message: 'Enter a valid email' }
  }
  const domain = trimmed.slice(trimmed.indexOf('@') + 1)
  if (!GMAIL_DOMAINS.has(domain)) {
    return { valid: true }
  }
  const local = trimmed.slice(0, trimmed.indexOf('@'))
  if (local.length < 6 || local.length > 30) {
    return { valid: false, message: 'Gmail usernames must be between 6 and 30 characters.' }
  }
  if (!/^[a-z0-9.]+$/.test(local)) {
    return { valid: false, message: 'Gmail usernames can only include letters, numbers, and periods.' }
  }
  if (local.startsWith('.') || local.endsWith('.')) {
    return { valid: false, message: 'Gmail usernames cannot start or end with a period.' }
  }
  if (local.includes('..')) {
    return { valid: false, message: 'Gmail usernames cannot contain consecutive periods.' }
  }
  return { valid: true, message: 'Gmail address format looks good.' }
}

function getActiveUserPhoto(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_PHOTO_KEY) || ''
}

function getActiveUserEmail(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_EMAIL_KEY) || ''
}

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

function setStoredAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

function requireApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured for this build.')
  }
  return API_BASE_URL
}

async function requestJson<T>(path: string, init: RequestInit = {}, includeAuth = false): Promise<T> {
  const baseUrl = requireApiBaseUrl()
  const headers = new Headers(init.headers || {})
  headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (includeAuth) {
    const token = getStoredAuthToken()
    if (!token) {
      throw new Error('Please sign in to continue.')
    }
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  let payload: unknown = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload ? (payload as any).message : null
    const error = new Error(message || 'Request failed. Please try again.')
    ;(error as any).status = response.status
    ;(error as any).payload = payload
    throw error
  }

  return payload as T
}

async function postJson<T>(path: string, body: unknown, includeAuth = false): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    includeAuth
  )
}

async function getJson<T>(path: string, includeAuth = false): Promise<T> {
  return requestJson<T>(path, { method: 'GET' }, includeAuth)
}

async function deleteJson(path: string, includeAuth = false): Promise<void> {
  await requestJson(path, { method: 'DELETE' }, includeAuth)
}

function applyApiUserSession(user: ApiUser, token?: string | null): ActiveProfile {
  if (token) {
    setStoredAuthToken(token)
    void refreshFollowingFromServer(true)
  } else if (token === null) {
    setStoredAuthToken(null)
    followedHydrated = false
    followedIds.clear()
  }

  return updateActiveProfile({
    id: user.handle || user.id,
    name: user.name,
    church: user.church ?? '',
    country: user.country ?? '',
    email: user.email,
    photo: user.photoUrl ?? undefined,
    isVerified: user.isVerified,
  })
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-')
}

function slugifyDisplayName(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `guest-${Math.random().toString(36).slice(2, 6)}`
}

function sanitizeHandle(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
}

function generateHandleSuggestion(value: string): string {
  if (!value.trim()) return ''
  const sanitized = sanitizeHandle(value)
  if (sanitized) return sanitized
  const fallback = slugifyDisplayName(value).replace(/-/g, '')
  return fallback || `friend${Math.random().toString(36).slice(2, 6)}`
}

function hashPassword(email: string, password: string): string {
  const input = `${email.toLowerCase()}::${password}`
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(16)
}

function simulateNetwork<T>(fn: () => T, failureRate = NETWORK_FAILURE_RATE): Promise<T> {
  const delay = NETWORK_DELAY_MIN + Math.random() * (NETWORK_DELAY_MAX - NETWORK_DELAY_MIN)
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (Math.random() < failureRate) {
        reject(new Error('Please try again in a moment.'))
        return
      }
      try {
        resolve(fn())
      } catch (err) {
        reject(err)
      }
    }, delay)
  })
}

function ensureUploadsHydrated() {
  if (uploadsHydrated || typeof window === 'undefined') return
  uploadsHydrated = true
  const raw = window.localStorage.getItem(UPLOAD_STORAGE_KEY)
  if (!raw) return
  try {
    const stored = JSON.parse(raw) as StoredUpload[]
    uploads = stored.map(reviveStoredUpload)
  } catch {
    uploads = []
  }
}

function persistUploads() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(uploads.map(makeSerializableUpload)))
}

function ensureFollowingHydrated() {
  if (followedHydrated || typeof window === 'undefined') return
  followedHydrated = true
  if (getStoredAuthToken()) {
    followedIds = new Set()
    void refreshFollowingFromServer(true)
    return
  }
  const raw = window.localStorage.getItem(FOLLOWING_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as string[]
      followedIds = new Set(parsed.map(normalizeId))
      return
    } catch {
      // ignore and fall back to defaults
    }
  }
  followedIds = new Set(GUEST_FOLLOW_DEFAULTS)
  window.localStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify([...followedIds]))
}

function persistFollowing() {
  if (typeof window === 'undefined' || getStoredAuthToken()) return
  window.localStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify([...followedIds]))
}

function refreshFollowingFromServer(force = false): Promise<void> | undefined {
  if (!getStoredAuthToken()) {
    return undefined
  }
  if (followingFetchPromise && !force) {
    return followingFetchPromise
  }
  followingFetchPromise = getJson<{ following: ApiUser[] }>('/api/follows/following', true)
    .then((payload) => {
      followedIds = new Set(payload.following.map((user) => normalizeId(user.handle || user.id)))
      notify()
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to refresh following list', error)
    })
    .finally(() => {
      followingFetchPromise = null
    })
  return followingFetchPromise
}

function getFollowedIds(): Set<string> {
  ensureFollowingHydrated()
  return followedIds
}

function ensureBookmarksHydrated() {
  if (bookmarksHydrated || typeof window === 'undefined') return
  bookmarksHydrated = true
  const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as string[]
      if (parsed.length) {
        bookmarkedIds = new Set(parsed)
        return
      }
    } catch {
      bookmarkedIds = new Set()
    }
  }
  if (!bookmarkedIds.size) {
    bookmarkedIds = new Set(DEFAULT_SAVED_IDS)
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([...bookmarkedIds]))
    notify()
  }
}

function persistBookmarks() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([...bookmarkedIds]))
}

function getSavedIds(): Set<string> {
  ensureBookmarksHydrated()
  return bookmarkedIds
}

function makeSerializableUpload(clip: Video): StoredUpload {
  const { videoUrl, ...rest } = clip
  return rest
}

function reviveStoredUpload(stored: StoredUpload): Video {
  return {
    ...stored,
    videoUrl: stored.thumbnailUrl || DEFAULT_VIDEO_PLACEHOLDER,
    likesDisplay: stored.likesDisplay ?? formatLikes(stored.likes),
  }
}

function updateActiveProfile(partial: ActiveProfileUpdate): ActiveProfile {
  const name = partial.name?.trim().length ? partial.name.trim() : getActiveUserName()
  const id = partial.id?.trim().toLowerCase().length ? partial.id.trim().toLowerCase() : getActiveUserId()
  const church = partial.church === undefined ? getActiveUserChurch() : partial.church?.trim() ?? ''
  const country = partial.country === undefined ? getActiveUserCountry() : partial.country?.trim() ?? ''
  const email = partial.email === undefined ? getActiveUserEmail() : partial.email?.trim().toLowerCase() ?? ''
  const photo = partial.photo === undefined ? getActiveUserPhoto() : partial.photo?.trim() ?? ''
  const isVerified = partial.isVerified === undefined ? getActiveUserVerified() : Boolean(partial.isVerified)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACTIVE_USER_NAME_KEY, name)
    window.localStorage.setItem(ACTIVE_USER_ID_KEY, id)
    if (church) {
      window.localStorage.setItem(ACTIVE_USER_CHURCH_KEY, church)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_CHURCH_KEY)
    }
    if (country) {
      window.localStorage.setItem(ACTIVE_USER_COUNTRY_KEY, country)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_COUNTRY_KEY)
    }
    if (photo) {
      window.localStorage.setItem(ACTIVE_USER_PHOTO_KEY, photo)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_PHOTO_KEY)
    }
    if (email) {
      window.localStorage.setItem(ACTIVE_USER_EMAIL_KEY, email)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_EMAIL_KEY)
    }
    if (isVerified) {
      window.localStorage.setItem(ACTIVE_USER_VERIFIED_KEY, 'true')
    } else {
      window.localStorage.removeItem(ACTIVE_USER_VERIFIED_KEY)
    }
  }

  const profile: ActiveProfile = { id, name, church, country, email, photo, isVerified }
  notify()
  return profile
}

function getActiveProfile(): ActiveProfile {
  return {
    id: getActiveUserId(),
    name: getActiveUserName(),
    church: getActiveUserChurch(),
    country: getActiveUserCountry(),
    email: getActiveUserEmail(),
    photo: getActiveUserPhoto(),
    isVerified: getActiveUserVerified(),
  }
}

function signInWithDisplayName(displayName: string): ActiveProfile {
  enforceModeration(MODERATION_CONTEXT_PROFILE, [{ label: 'Display name', text: displayName }])
  const name = displayName.trim() || 'Guest Creator'
  const id = slugifyDisplayName(name)
  return updateActiveProfile({ id, name, church: null, country: null, isVerified: false })
}

function signOutToGuest(): ActiveProfile {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACTIVE_USER_NAME_KEY)
    window.localStorage.removeItem(ACTIVE_USER_CHURCH_KEY)
    window.localStorage.removeItem(ACTIVE_USER_COUNTRY_KEY)
    window.localStorage.removeItem(ACTIVE_USER_ID_KEY)
    window.localStorage.removeItem(ACTIVE_USER_PHOTO_KEY)
    window.localStorage.removeItem(ACTIVE_USER_EMAIL_KEY)
    window.localStorage.removeItem(ACTIVE_USER_VERIFIED_KEY)
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(FOLLOWING_STORAGE_KEY)
  }
  followedIds = new Set()
  followedHydrated = false
  followingFetchPromise = null
  return updateActiveProfile({
    id: 'guest',
    name: 'Guest Creator',
    church: null,
    country: null,
    photo: null,
    email: null,
    isVerified: false,
  })
}

async function createAccount(input: {
  name: string
  handle: string
  email: string
  password: string
  church?: string
  country?: string
  photo?: string | null
}): Promise<ActiveProfile> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Display name is required')
  }
  const normalizedHandle = sanitizeHandle(input.handle)
  if (!normalizedHandle) {
    throw new Error('Handle is required')
  }
  const email = input.email.trim().toLowerCase()
  if (!email) {
    throw new Error('Email is required')
  }
  const emailCheck = verifyEmailStructure(email)
  if (!emailCheck.valid) {
    throw new Error(emailCheck.message || 'We could not verify this email address. Double-check and try again.')
  }
  const password = input.password.trim()
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  enforceModeration(MODERATION_CONTEXT_PROFILE, [
    { label: 'Display name', text: name },
    { label: 'Handle', text: input.handle },
    { label: 'Church / Community', text: input.church ?? '' },
    { label: 'Country', text: input.country ?? '' },
  ])

  const payload = await postJson<{ user: ApiUser; message: string; verificationUrl?: string }>('/api/auth/signup', {
    name,
    handle: normalizedHandle,
    email,
    password,
    church: input.church?.trim() || undefined,
    country: input.country?.trim() || undefined,
  })

  setStoredAuthToken(null)
  return applyApiUserSession(payload.user, null)
}

async function signInWithCredentials(email: string, password: string): Promise<ActiveProfile> {
  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    throw new Error('Enter your email')
  }
  if (!password.trim()) {
    throw new Error('Enter your password')
  }

  const payload = await postJson<{ token: string; user: ApiUser }>('/api/auth/login', {
    email: trimmedEmail,
    password,
  })

  return applyApiUserSession(payload.user, payload.token)
}

function completeSignup(input: {
  name: string
  handle: string
  church?: string
  country?: string
  photo?: string | null
  email?: string
}): Promise<ActiveProfile> {
  return Promise.resolve().then(() => {
    const name = input.name.trim()
    if (!name) {
      throw new Error('Display name is required')
    }
    const normalizedHandle = sanitizeHandle(input.handle)
    if (!normalizedHandle) {
      throw new Error('Handle is required')
    }
    const desiredEmail = (input.email?.trim().toLowerCase() ?? getActiveUserEmail()).trim()
    if (!desiredEmail) {
      throw new Error('Email is required')
    }
    const emailCheck = verifyEmailStructure(desiredEmail)
    if (!emailCheck.valid) {
      throw new Error(emailCheck.message || 'We could not verify this email address. Double-check and try again.')
    }

    enforceModeration(MODERATION_CONTEXT_PROFILE, [
      { label: 'Display name', text: name },
      { label: 'Handle', text: input.handle },
      { label: 'Church / Community', text: input.church ?? '' },
      { label: 'Country', text: input.country ?? '' },
    ])

    return updateActiveProfile({
      id: normalizedHandle,
      name,
      church: input.church?.trim() ?? '',
      country: input.country?.trim() ?? '',
      email: desiredEmail,
      photo: input.photo ?? undefined,
      isVerified: getActiveUserVerified(),
    })
  })
}

async function verifyEmailCode(email: string, code: string): Promise<ActiveProfile> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedCode = code.trim()
  if (!trimmedEmail) {
    throw new Error('Enter your email.')
  }
  if (!trimmedCode) {
    throw new Error('Enter the verification code.')
  }
  const payload = await postJson<{ user: ApiUser; message: string }>('/api/auth/verify-email', {
    email: trimmedEmail,
    code: trimmedCode,
  })
  return applyApiUserSession(payload.user, null)
}

async function resendVerification(email: string): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    throw new Error('Enter your email')
  }
  await postJson<{ message: string }>('/api/auth/resend-verification', { email: trimmedEmail })
}

async function matchContactsByEmail(emails: string[]): Promise<ContactMatch[]> {
  const normalized = emails
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
  if (!normalized.length) {
    return []
  }
  const hashes = await Promise.all(normalized.map(hashEmailForMatch))
  const payload = await postJson<{ matches: ContactMatch[] }>('/api/contacts/match', { hashes })
  return payload.matches
}

async function hashEmailForMatch(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ''
  }
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(normalized)
    const digest = await window.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  return hashPassword(normalized, normalized)
}

function mapApiVideo(video: ApiFeedVideo): Video {
  const likeCount = video.stats?.likes ?? 0
  return {
    id: video.id,
    title: video.title,
    description: video.description ?? '',
    user: {
      id: video.user.id,
      name: video.user.name || video.user.handle,
      churchHome: video.user.church ?? undefined,
      avatar: video.user.photoUrl ?? undefined,
    },
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl || video.videoUrl,
    category: (video.category as ContentCategory) || 'testimony',
    tags: video.tags ?? [],
    durationSec: video.durationSeconds ?? 0,
    likes: likeCount,
    likesDisplay: formatLikes(likeCount),
    comments: video.stats?.comments ?? 0,
    bookmarks: 0,
    shares: 0,
    donations: 0,
    publishedAt: video.createdAt,
  }
}

function ensureLibraryHydrated() {
  ensureUploadsHydrated()
}

function getLibrary(): Video[] {
  ensureLibraryHydrated()
  return [...remoteFeed, ...uploads, ...seedVideos]
}

function notify() {
  listeners.forEach((listener) => listener())
}

function persistIfUpload(clipId: string) {
  if (uploads.find((item) => item.id === clipId)) {
    persistUploads()
  }
}

function filterFaithCentric(clips: Video[]): Video[] {
  return clips.filter((clip) => {
    if (!clip.tags.length) return true
    const blockedTags = ['secular', 'explicit']
    return !clip.tags.some((tag) => blockedTags.includes(tag))
  })
}

function sortForFeed(clips: Video[]): Video[] {
  return clips
    .slice()
    .sort((a, b) => {
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
}

export const contentService = {
  matchContactsByEmail,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getActiveProfile,
  updateActiveProfile,
  completeSignup,
  createAccount,
  signInWithCredentials,
  verifyEmailCode,
  resendVerification,
  signIn(displayName: string) {
    return signInWithDisplayName(displayName)
  },
  signOut() {
    setStoredAuthToken(null)
    return signOutToGuest()
  },
  suggestHandle(name: string) {
    return generateHandleSuggestion(name)
  },
  async followUser(userId: string) {
    const normalized = normalizeId(userId.replace(/^@/, ''))
    if (!normalized) {
      return false
    }
    if (getStoredAuthToken()) {
      await postJson(`/api/follows/${encodeURIComponent(normalized)}`, {}, true)
      followedIds.add(normalized)
      notify()
      return true
    }
    return simulateNetwork(() => {
      ensureFollowingHydrated()
      if (!followedIds.has(normalized)) {
        followedIds.add(normalized)
        persistFollowing()
        notify()
      }
      return true
    })
  },
  async unfollowUser(userId: string) {
    const normalized = normalizeId(userId.replace(/^@/, ''))
    if (!normalized) {
      return false
    }
    if (getStoredAuthToken()) {
      await deleteJson(`/api/follows/${encodeURIComponent(normalized)}`, true)
      if (followedIds.has(normalized)) {
        followedIds.delete(normalized)
        notify()
      }
      return false
    }
    return simulateNetwork(() => {
      ensureFollowingHydrated()
      if (followedIds.has(normalized)) {
        followedIds.delete(normalized)
        persistFollowing()
        notify()
      }
      return false
    })
  },
  isFollowing(userId: string) {
    ensureFollowingHydrated()
    return followedIds.has(normalizeId(userId))
  },
  toggleFollow(userId: string) {
    const normalized = normalizeId(userId.replace(/^@/, ''))
    if (followedIds.has(normalized)) {
      return this.unfollowUser(userId).then(() => false)
    }
    return this.followUser(userId).then(() => true)
  },
  listFollowingIds(): string[] {
    return [...getFollowedIds()]
  },
  isBookmarked(clipId: string) {
    ensureBookmarksHydrated()
    return bookmarkedIds.has(clipId)
  },
  listSavedClipIds(): string[] {
    return [...getSavedIds()]
  },
  getSavedClips(): Video[] {
    const savedIds = getSavedIds()
    if (!savedIds.size) return []
    return getLibrary().filter((clip) => savedIds.has(clip.id))
  },
  toggleBookmark(clipId: string) {
    ensureBookmarksHydrated()
    const clip = getLibrary().find((item) => item.id === clipId)
    if (bookmarkedIds.has(clipId)) {
      bookmarkedIds.delete(clipId)
      if (clip && clip.bookmarks) {
        clip.bookmarks = Math.max(0, clip.bookmarks - 1)
      }
    } else {
      bookmarkedIds.add(clipId)
      if (clip) {
        clip.bookmarks = (clip.bookmarks ?? 0) + 1
      }
    }
    persistBookmarks()
    if (clip) {
      persistIfUpload(clipId)
    }
    notify()
    return bookmarkedIds.has(clipId)
  },
  async fetchForYouFeed(): Promise<Video[]> {
    const payload = await getJson<{ videos: ApiFeedVideo[] }>('/api/feed/for-you')
    const mapped = payload.videos.map(mapApiVideo)
    remoteFeed = mapped
    return mapped
  },
  async fetchFollowingFeed(): Promise<Video[]> {
    try {
      const payload = await getJson<{ videos: ApiFeedVideo[] }>('/api/feed/following', true)
      const mapped = payload.videos.map(mapApiVideo)
      remoteFeed = mapped
      return mapped
    } catch (error) {
      if ((error as any)?.status === 401) {
        return []
      }
      throw error
    }
  },
  async fetchCollectionFeed(collection: ContentCollection): Promise<Video[]> {
    const curated = filterFaithCentric(getLibrary().filter((clip) => clip.collection === collection))
    return sortForFeed(curated)
  },
  getGuides(): VesselGuide[] {
    return curatedGuides
  },
  getClipById(id: string): Video | undefined {
    return getLibrary().find((clip) => clip.id === id)
  },
  async createUpload(input: {
    title: string
    description?: string
    file?: File
    category?: ContentCategory
    tags?: string[]
  }): Promise<Video> {
    const activeProfile = getActiveProfile()
    const normalizedId = normalizeId(activeProfile.id || '')
    const normalizedName = (activeProfile.name || '').trim().toLowerCase()
    const isGuestProfile = normalizedId === 'guest' || normalizedName === 'guest creator' || !activeProfile.email
    if (isGuestProfile) {
      throw new Error('Sign in to your Vessel profile before uploading a video.')
    }
    enforceModeration(MODERATION_CONTEXT_UPLOAD, [
      { label: 'Title', text: input.title },
      { label: 'Description', text: input.description ?? '' },
    ])
    const form = new FormData()
    form.append('title', input.title.trim())
    if (input.description) {
      form.append('description', input.description)
    }
    if (input.category) {
      form.append('category', input.category)
    }
    if (input.tags?.length) {
      form.append('tags', JSON.stringify(input.tags))
    }
    if (input.file) {
      form.append('file', input.file)
    } else {
      form.append('videoUrl', DEFAULT_VIDEO_PLACEHOLDER)
      form.append('thumbnailUrl', DEFAULT_THUMB_PLACEHOLDER)
    }
    const payload = await requestJson<{ video: ApiFeedVideo }>(
      '/api/feed/videos',
      {
        method: 'POST',
        body: form,
      },
      true
    )
    const clip = mapApiVideo(payload.video)
    remoteFeed = [clip, ...remoteFeed.filter((video) => video.id !== clip.id)]
    notify()
    return clip
  },
  async recordLike(clipId: string) {
    if (getStoredAuthToken()) {
      await postJson(`/api/videos/${encodeURIComponent(clipId)}/like`, {}, true)
    }

    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) {
      notify()
      return
    }
    clip.likes += 1
    clip.likesDisplay = formatLikes(clip.likes)
    persistIfUpload(clipId)
    notify()
  },
  async recordComment(clipId: string, body?: string) {
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) return

    if (getStoredAuthToken()) {
      await postJson(
        `/api/videos/${encodeURIComponent(clipId)}/comments`,
        { body: body || 'Amen! Thanks for sharing this.' },
        true
      )
    }

    clip.comments = (clip.comments ?? 0) + 1
    persistIfUpload(clipId)
    notify()
  },
  recordShare(clipId: string) {
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) return
    clip.shares = (clip.shares ?? 0) + 1
    persistIfUpload(clipId)
    notify()
  },
  recordDonation(clipId: string, amount = 1) {
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) return
    clip.donations = (clip.donations ?? 0) + amount
    persistIfUpload(clipId)
    notify()
  },
  getClipsByAuthor(authorId: string): Video[] {
    const normalizedTarget = normalizeId(authorId.startsWith('@') ? authorId.slice(1) : authorId)
    return getLibrary().filter((clip) => {
      const clipId = normalizeId(clip.user.id || '')
      const normalizedName = normalizeId(clip.user.name)
      return clipId === normalizedTarget || normalizedName === normalizedTarget
    })
  },
  getLikedFeedFor(userId: string): Video[] {
    const normalized = normalizeId(userId)
    const library = getLibrary()
    const likedPool = library.filter((clip) => normalizeId(clip.user.id) !== normalized)
    return likedPool
      .slice()
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 18)
  },
}

export type { Video, ContentCategory, ContentCollection, ActiveProfile }
