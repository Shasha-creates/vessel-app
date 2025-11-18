// src/services/mockData.ts
//
// Provides the seed content and shared helpers that power the in-browser
// mock service for the Vessel prototype.

export function parseShortNumber(input: number | string): number {
  if (typeof input === 'number') return input
  if (typeof input !== 'string') return NaN

  const trimmed = input.trim()
  const match = trimmed.match(/^([+-]?\d+(\.\d+)?)([kKmMbBtT])?$/)
  if (!match) {
    const fallback = Number(trimmed.replace(/,/g, ''))
    return Number.isFinite(fallback) ? fallback : NaN
  }

  const value = parseFloat(match[1])
  const unit = (match[3] || '').toUpperCase()
  const multipliers: Record<string, number> = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
    T: 1_000_000_000_000,
  }

  return unit ? value * (multipliers[unit] ?? 1) : value
}

export function formatLikes(n: number, threshold = 10_000): string {
  if (!Number.isFinite(n)) return String(n)
  if (n < threshold) return String(n)

  const units = ['K', 'M', 'B', 'T']
  let value = n
  let index = -1

  while (value >= 1000 && index < units.length - 1) {
    value /= 1000
    index++
  }

  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString()
  return `${formatted.replace(/\.0$/, '')}${units[index] ?? ''}`
}

export type User = {
  id: string
  name: string
  avatar?: string
  churchHome?: string
  ministryRole?: string
  handle?: string
  accountId?: string
}

export type ScriptureReference = {
  book: string
  chapter: number
  verses: string
  translation?: string
  summary?: string
}

export type ContentCategory = 'worship' | 'devotional' | 'teaching' | 'testimony' | 'prayer'

export type ContentCollection = 'dawn-devotional' | 'evening-reflection' | 'youth-night' | 'family-prayer'

export type Video = {
  id: string
  title: string
  description: string
  user: User
  videoUrl: string
  thumbnailUrl: string
  category: ContentCategory
  tags: string[]
  scripture?: ScriptureReference
  durationSec: number
  likes: number
  likesDisplay?: string
  publishedAt: string
  collection?: ContentCollection
  featured?: boolean
  comments?: number
  bookmarks?: number
  shares?: number
  donations?: number
}

export type VesselGuide = {
  id: string
  title: string
  description: string
  collection: ContentCollection
  scriptureFocus: ScriptureReference
  mood: 'uplifting' | 'reflective' | 'energetic' | 'contemplative'
}

const sampleVideos: Video[] = [
  {
    id: 'psalm23-reflection',
    title: 'Peace in the Valley - Psalm 23',
    description: 'A quiet devotional inviting you to rest in the Shepherd who restores our souls.',
    user: { id: 'sarah-grace', name: 'Sarah Grace', churchHome: 'Restoration Chapel', ministryRole: 'Worship Leader' },
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    thumbnailUrl: '',
    category: 'devotional',
    tags: ['rest', 'psalm-23', 'shepherd'],
    scripture: {
      book: 'Psalms',
      chapter: 23,
      verses: '1-3',
      translation: 'ESV',
      summary: 'The Lord shepherds us and leads us beside still waters.',
    },
    durationSec: 92,
    likes: parseShortNumber('125k'),
    likesDisplay: formatLikes(parseShortNumber('125k')),
    comments: 4800,
    bookmarks: 2100,
    shares: 1250,
    donations: 320,
    publishedAt: '2025-10-18T07:30:00Z',
    collection: 'dawn-devotional',
    featured: true,
  },
  {
    id: 'sunrise-worship',
    title: 'Sunrise Worship Session',
    description: 'An intimate vertical capture of worship on the beach as the sun rises.',
    user: { id: 'coastal-worship', name: 'Coastal Worship Collective', churchHome: 'Harbor City Church' },
    videoUrl: 'https://cdn.coverr.co/videos/coverr-prayer-on-the-beach-0001/vertical.mp4',
    thumbnailUrl: 'https://cdn.coverr.co/videos/coverr-prayer-on-the-beach-0001/vertical.mp4',
    category: 'worship',
    tags: ['sunrise', 'beach', 'worship'],
    scripture: {
      book: 'Psalms',
      chapter: 113,
      verses: '3',
      summary: 'From the rising of the sun to its setting, the name of the Lord is to be praised.',
    },
    durationSec: 95,
    likes: parseShortNumber('18k'),
    likesDisplay: formatLikes(parseShortNumber('18k')),
    comments: 2400,
    bookmarks: 1200,
    shares: 860,
    donations: 75,
    publishedAt: '2025-10-19T06:00:00Z',
    collection: 'dawn-devotional',
    featured: true,
  },
  {
    id: 'testimony-freedom',
    title: 'From Fear to Freedom',
    description: 'Marcus shares how the Lord met him in anxiety and brought lasting freedom.',
    user: { id: 'marcus-bold', name: 'Marcus Bolden', churchHome: 'New Life Fellowship' },
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    thumbnailUrl: '',
    category: 'testimony',
    tags: ['deliverance', 'hope', 'testimony'],
    scripture: {
      book: '2 Timothy',
      chapter: 1,
      verses: '7',
      summary: 'God has not given us a spirit of fear but of power, love, and self-control.',
    },
    durationSec: 138,
    likes: parseShortNumber('58k'),
    likesDisplay: formatLikes(parseShortNumber('58k')),
    comments: 3100,
    bookmarks: 940,
    shares: 725,
    donations: 150,
    publishedAt: '2025-10-17T22:15:00Z',
    collection: 'evening-reflection',
  },
  {
    id: 'worship-session',
    title: 'Live Worship: Set a Fire',
    description: 'Join River City Worship for a passionate time of praise and intercession.',
    user: {
      id: 'river-city-worship',
      name: 'River City Worship Collective',
      churchHome: 'River City Church',
      ministryRole: 'Worship Collective',
    },
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    thumbnailUrl: '',
    category: 'worship',
    tags: ['worship', 'ignite', 'revival'],
    durationSec: 301,
    likes: parseShortNumber('1.2M'),
    likesDisplay: formatLikes(parseShortNumber('1.2M')),
    comments: parseShortNumber('128k'),
    bookmarks: parseShortNumber('46k'),
    shares: parseShortNumber('32k'),
    donations: parseShortNumber('12k'),
    publishedAt: '2025-10-16T18:45:00Z',
    collection: 'youth-night',
    featured: true,
  },
  {
    id: 'prayer-moment',
    title: 'Morning Prayer for Families',
    description: 'A short prayer you can pray over your household to begin the day grounded in peace.',
    user: {
      id: 'pastor-ana',
      name: 'Pastor Ana Rivera',
      churchHome: 'Hope City Espanol',
      ministryRole: 'Family Pastor',
    },
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    thumbnailUrl: '',
    category: 'prayer',
    tags: ['family', 'peace', 'morning-prayer'],
    scripture: {
      book: 'Numbers',
      chapter: 6,
      verses: '24-26',
      translation: 'CSB',
      summary: 'The Lord bless you and keep you.',
    },
    durationSec: 75,
    likes: parseShortNumber('32k'),
    likesDisplay: formatLikes(parseShortNumber('32k')),
    comments: 2200,
    bookmarks: 1800,
    shares: 960,
    donations: 480,
    publishedAt: '2025-10-20T11:15:00Z',
    collection: 'family-prayer',
  },
  {
    id: 'bible-study-romans8',
    title: 'Romans 8: Life in the Spirit',
    description: 'Pastor Jordan unpacks what it means to live as more than conquerors through Christ.',
    user: { id: 'jordan-hale', name: 'Jordan Hale', churchHome: 'Citizens Church', ministryRole: 'Teaching Pastor' },
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    thumbnailUrl: '',
    category: 'teaching',
    tags: ['romans-8', 'identity', 'gospel'],
    scripture: {
      book: 'Romans',
      chapter: 8,
      verses: '1-11',
      translation: 'NLT',
      summary: 'There is no condemnation for those in Christ Jesus.',
    },
    durationSec: 420,
    likes: parseShortNumber('86k'),
    likesDisplay: formatLikes(parseShortNumber('86k')),
    comments: 6400,
    bookmarks: 2500,
    shares: 1400,
    donations: 260,
    publishedAt: '2025-10-15T14:25:00Z',
    collection: 'evening-reflection',
  },
]

export const curatedGuides: VesselGuide[] = [
  {
    id: 'steady-heart',
    title: 'Steady Heart - Trust in Uncertain Times',
    description: 'Five short clips to remind you that Christ is the anchor of hope.',
    collection: 'dawn-devotional',
    scriptureFocus: {
      book: 'Hebrews',
      chapter: 6,
      verses: '19',
      summary: 'Hope in Christ is a sure and steadfast anchor for the soul.',
    },
    mood: 'reflective',
  },
  {
    id: 'joyful-noise',
    title: 'Joyful Noise - Worship that Lifts the Room',
    description: 'Energetic worship moments curated for youth nights and gatherings.',
    collection: 'youth-night',
    scriptureFocus: {
      book: 'Psalms',
      chapter: 100,
      verses: '1-2',
      summary: 'Make a joyful noise to the Lord, serve Him with gladness.',
    },
    mood: 'energetic',
  },
]

export const videos: Video[] = [...sampleVideos]

export async function addMockUpload(title: string, file: File, description = '') {
  const url = URL.createObjectURL(file)
  const now = new Date()
  const clip: Video = {
    id: `upload-${now.getTime()}`,
    title,
    description: description || 'Shared on Vessel to encourage the community.',
    user: {
      id: localStorage.getItem('vessel_user_id') || 'me',
      name: localStorage.getItem('vessel_user') || 'Guest Creator',
    },
    videoUrl: url,
    thumbnailUrl: url,
    category: 'testimony',
    tags: ['community', 'testimony'],
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
  videos.unshift(clip)
  return clip
}

export function updateLikesDisplay(video: Video) {
  video.likesDisplay = formatLikes(video.likes)
}