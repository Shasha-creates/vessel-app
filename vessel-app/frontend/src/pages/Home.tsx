import React from 'react'
import { Link } from 'react-router-dom'
import VideoCard from '../shared/VideoCard'
import { contentService, type Video } from '../services/contentService'
import styles from './Home.module.css'

export default function Home() {
  const [featured, setFeatured] = React.useState<Video[]>([])

  React.useEffect(() => {
    async function load() {
      const feed = await contentService.fetchForYouFeed()
      setFeatured(feed.slice(0, 3))
    }
    load()
  }, [])

  return (
    <div className={styles.home}>
      <header className={styles.hero}>
        <h1>Vessel brings faith-filled stories to your daily scroll.</h1>
        <p>
          Explore worship moments, testimonies, and scripture meditations designed to strengthen your walk with Jesus
          and spark hope in others.
        </p>
      </header>
      <section className={styles.featured}>
        {featured.map((clip) => (
          <Link key={clip.id} to={`/watch/${clip.id}`} className={styles.cardLink}>
            <VideoCard video={clip} />
          </Link>
        ))}
      </section>
    </div>
  )
}
