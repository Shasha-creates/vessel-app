import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import VideoCard from '../shared/VideoCard'
import { contentService, type Video } from '../services/contentService'
import { Media } from '../media'
import styles from './Home.module.css'

export default function Home() {
  const [featured, setFeatured] = React.useState<Video[]>([])
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') || '').trim()
  const normalizedQuery = query.toLowerCase()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      try {
        const feed = await contentService.fetchForYouFeed()
        setFeatured(feed)
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load the featured feed.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const searchResults = React.useMemo(() => {
    if (!normalizedQuery) {
      return []
    }
    return featured.filter((clip) => {
      const haystack = [
        clip.title,
        clip.description,
        clip.user.name,
        clip.category,
        clip.tags?.join(' ') ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [featured, normalizedQuery])

  const heroCards = React.useMemo(() => featured.slice(0, 3), [featured])
  const isSearching = !!normalizedQuery

  return (
    <div className={styles.home}>
      {isSearching ? (
        <section className={styles.searchPanel}>
          <div>
            <p className={styles.searchEyebrow}>Search Godlyme</p>
            <h1 className={styles.searchHeading}>Results for “{query}”</h1>
            <p className={styles.searchTip}>
              Looking for a specific creator? Start your search with “@” to jump straight to their handle. You can also
              search topics, testimonies, and prayer themes to explore inspiring moments.
            </p>
          </div>
          {loading ? (
            <p className={styles.searchStatus}>Searching the latest moments…</p>
          ) : error ? (
            <p className={`${styles.searchStatus} ${styles.searchError}`}>{error}</p>
          ) : searchResults.length ? (
            <div className={styles.searchResults}>
              {searchResults.map((clip) => (
                <Link key={clip.id} to={`/watch/${clip.id}`} className={styles.cardLink}>
                  <VideoCard video={clip} />
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.searchStatus}>
              No matching clips yet. Try a different keyword or search with “@handle” to jump directly to a profile.
            </p>
          )}
        </section>
      ) : (
        <>
          <header className={styles.hero}>
            <img src={Media.icons.logo} alt="Godlyme" className={styles.brandMark} />
            <h1>Vessel brings faith-filled stories to your daily scroll.</h1>
            <p>
              Explore worship moments, testimonies, and scripture meditations designed to strengthen your walk with
              Jesus and spark hope in others.
            </p>
            <p className={styles.heroTip}>
              Tip: Tap the search icon in the app to look up creators, verses, and topics—start with “@” for handles.
            </p>
          </header>
          <section className={styles.featured}>
            {heroCards.map((clip) => (
              <Link key={clip.id} to={`/watch/${clip.id}`} className={styles.cardLink}>
                <VideoCard video={clip} />
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
