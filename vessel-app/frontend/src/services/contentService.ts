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
const ACCOUNTS_STORAGE_KEY = 'vessel_accounts_v1'
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

type StoredUpload = Omit<Video, 'videoUrl'>
type CommentableVideo = Video

type ActiveProfile = {
  id: string
  name: string
  church: string
  country: string
  email: string
  photo?: string
}

type ActiveProfileUpdate = {
  id?: string
  name?: string
  church?: string | null
  country?: string | null
  email?: string | null
  photo?: string | null
}

type AccountRecord = {
  id: string
  name: string
  email: string
  passwordHash: string
  church: string
  country: string
  photo?: string
}

type EmailVerificationResult = {
  valid: boolean
  message?: string
}

const listeners = new Set<Listener>()
let uploadsHydrated = false
let uploads: Video[] = []
let accountsHydrated = false
let accounts: AccountRecord[] = []
let followedHydrated = false
let followedIds = new Set<string>()
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

function ensureAccountsHydrated() {
  if (accountsHydrated || typeof window === 'undefined') return
  accountsHydrated = true
  const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY)
  if (!raw) {
    accounts = []
    return
  }
  try {
    const parsed = JSON.parse(raw) as Array<Partial<AccountRecord> & { country?: string }>
    accounts = parsed.map((record) => ({
      ...record,
      country: record.country ?? '',
    })) as AccountRecord[]
  } catch {
    accounts = []
  }
}

function persistAccounts() {
  if (typeof window === 'undefined') return
  ensureAccountsHydrated()
  window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts))
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
  followedIds = new Set(['sarah-grace', 'river-city-worship', 'pastor-ana'].map(normalizeId))
  window.localStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify([...followedIds]))
}

function persistFollowing() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify([...followedIds]))
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
  }

  const profile: ActiveProfile = { id, name, church, country, email, photo }
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
  }
}

function signInWithDisplayName(displayName: string): ActiveProfile {
  enforceModeration(MODERATION_CONTEXT_PROFILE, [{ label: 'Display name', text: displayName }])
  const name = displayName.trim() || 'Guest Creator'
  const id = slugifyDisplayName(name)
  return updateActiveProfile({ id, name, church: null, country: null })
}

function signOutToGuest(): ActiveProfile {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACTIVE_USER_NAME_KEY)
    window.localStorage.removeItem(ACTIVE_USER_CHURCH_KEY)
    window.localStorage.removeItem(ACTIVE_USER_COUNTRY_KEY)
    window.localStorage.removeItem(ACTIVE_USER_ID_KEY)
    window.localStorage.removeItem(ACTIVE_USER_PHOTO_KEY)
    window.localStorage.removeItem(ACTIVE_USER_EMAIL_KEY)
  }
  return updateActiveProfile({
    id: 'guest',
    name: 'Guest Creator',
    church: null,
    country: null,
    photo: null,
    email: null,
  })
}

function createAccount(input: {
  name: string
  handle: string
  email: string
  password: string
  church?: string
  country?: string
  photo?: string | null
}): Promise<ActiveProfile> {
  return simulateNetwork(() => {
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

    ensureAccountsHydrated()
    if (accounts.some((acct) => acct.email === email)) {
      throw new Error('Email already has an account. Try signing in instead.')
    }
    if (accounts.some((acct) => acct.id === normalizedHandle)) {
      throw new Error('Handle already in use. Choose a different one.')
    }

    const record: AccountRecord = {
      id: normalizedHandle,
      name,
      email,
      church: input.church?.trim() ?? '',
      country: input.country?.trim() ?? '',
      photo: input.photo ?? undefined,
      passwordHash: hashPassword(email, password),
    }

    accounts.push(record)
    persistAccounts()
    return updateActiveProfile({
      id: record.id,
      name: record.name,
      church: record.church,
      country: record.country,
      email: record.email,
      photo: record.photo,
    })
  })
}

function signInWithCredentials(email: string, password: string): Promise<ActiveProfile> {
  return simulateNetwork(() => {
    ensureAccountsHydrated()
    const normalizedEmail = email.trim().toLowerCase()
    const account = accounts.find((acct) => acct.email === normalizedEmail)
    if (!account) {
      throw new Error('No account found for that email.')
    }
    if (account.passwordHash !== hashPassword(normalizedEmail, password.trim())) {
      throw new Error('Incorrect password. Please try again.')
    }
    return updateActiveProfile({
      id: account.id,
      name: account.name,
      church: account.church,
      country: account.country,
      email: account.email,
      photo: account.photo,
    })
  })
}

function completeSignup(input: {
  name: string
  handle: string
  church?: string
  country?: string
  photo?: string | null
  email?: string
  password?: string
}): Promise<ActiveProfile> {
  return simulateNetwork(() => {
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

  ensureAccountsHydrated()
    const currentEmail = getActiveUserEmail()
    let account = accounts.find((acct) => acct.email === currentEmail)

    if (!account) {
      if (!input.password?.trim()) {
        throw new Error('Set a password before saving your profile.')
      }
      if (accounts.some((acct) => acct.email === desiredEmail)) {
        throw new Error('Email already registered. Use another email.')
      }
      if (accounts.some((acct) => acct.id === normalizedHandle)) {
        throw new Error('Handle already in use. Choose a different one.')
      }
      account = {
        id: normalizedHandle,
        name,
        email: desiredEmail,
        church: input.church?.trim() ?? '',
        country: input.country?.trim() ?? '',
        photo: input.photo ?? undefined,
        passwordHash: hashPassword(desiredEmail, input.password!.trim()),
      }
      accounts.push(account)
    } else {
      if (account.id !== normalizedHandle && accounts.some((acct) => acct.id === normalizedHandle)) {
        throw new Error('Handle already in use. Choose a different one.')
      }
      if (account.email !== desiredEmail && accounts.some((acct) => acct.email === desiredEmail)) {
        throw new Error('Email already registered. Use another email.')
      }
      account.id = normalizedHandle
      account.name = name
      account.church = input.church?.trim() ?? ''
      account.country = input.country?.trim() ?? ''
      account.photo = input.photo ?? undefined
      account.email = desiredEmail
      if (input.password?.trim()) {
        account.passwordHash = hashPassword(desiredEmail, input.password.trim())
      }
    }

    persistAccounts()
    return updateActiveProfile({
      id: account.id,
      name: account.name,
      church: account.church,
      country: account.country,
      email: account.email,
      photo: account.photo,
    })
  })
}

function ensureLibraryHydrated() {
  ensureUploadsHydrated()
}

function getLibrary(): Video[] {
  ensureLibraryHydrated()
  return [...uploads, ...seedVideos]
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
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getActiveProfile,
  updateActiveProfile,
  completeSignup,
  createAccount,
  signInWithCredentials,
  signIn(displayName: string) {
    return signInWithDisplayName(displayName)
  },
  signOut() {
    return signOutToGuest()
  },
  suggestHandle(name: string) {
    return generateHandleSuggestion(name)
  },
  async followUser(userId: string) {
    return simulateNetwork(() => {
      ensureFollowingHydrated()
      const normalized = normalizeId(userId)
      if (normalized && !followedIds.has(normalized)) {
        followedIds.add(normalized)
        persistFollowing()
        notify()
      }
      return true
    })
  },
  async unfollowUser(userId: string) {
    return simulateNetwork(() => {
      ensureFollowingHydrated()
      const normalized = normalizeId(userId)
      if (followedIds.has(normalized)) {
        followedIds.delete(normalized)
        persistFollowing()
        notify()
      }
      return true
    })
  },
  isFollowing(userId: string) {
    ensureFollowingHydrated()
    return followedIds.has(normalizeId(userId))
  },
  toggleFollow(userId: string) {
    if (followedIds.has(normalizeId(userId))) {
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
    const curated = filterFaithCentric(getLibrary())
    return sortForFeed(curated)
  },
  async fetchFollowingFeed(): Promise<Video[]> {
    const following = getFollowedIds()
    const curated = filterFaithCentric(
      getLibrary().filter((clip) => {
        const clipId = normalizeId(clip.user.id)
        const normalizedName = normalizeId(clip.user.name)
        return following.has(clipId) || following.has(normalizedName)
      })
    )
    return curated.length ? sortForFeed(curated) : []
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
    const normalizedId = normalizeId(activeProfile.id || "")
    const normalizedName = (activeProfile.name || "").trim().toLowerCase()
    const isGuestProfile =
      normalizedId === "guest" || normalizedName === "guest creator" || !activeProfile.email
    if (isGuestProfile) {
      throw new Error('Sign in to your Vessel profile before uploading a video.')
    }
    enforceModeration(MODERATION_CONTEXT_UPLOAD, [
      { label: 'Title', text: input.title },
      { label: 'Description', text: input.description ?? '' },
    ])
    const now = new Date()
    const videoUrl = input.file ? URL.createObjectURL(input.file) : DEFAULT_VIDEO_PLACEHOLDER
    const thumbnailUrl = input.file ? videoUrl : DEFAULT_THUMB_PLACEHOLDER
    const clip: Video = {
      id: `upload-${now.getTime()}`,
      title: input.title || 'Untitled Testimony',
      description: input.description || 'Shared on Vessel to encourage the community.',
      user: {
        id: getActiveUserId(),
        name: getActiveUserName(),
      },
      videoUrl,
      thumbnailUrl,
      category: input.category ?? 'testimony',
      tags: input.tags ?? ['community', 'testimony'],
      durationSec: 0,
      likes: 0,
      likesDisplay: formatLikes(0),
      comments: 0,
      bookmarks: 0,
      shares: 0,
      donations: 0,
      publishedAt: now.toISOString(),
      collection: 'dawn-devotional',
    }

    uploads.unshift(clip)
    persistUploads()
    notify()
    return clip
  },
  recordLike(clipId: string) {
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) return
    clip.likes += 1
    clip.likesDisplay = formatLikes(clip.likes)
    persistIfUpload(clipId)
    notify()
  },
  recordComment(clipId: string) {
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) return
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
