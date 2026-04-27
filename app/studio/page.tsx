'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActivityStoryData } from '@/components/StoryGenerator/storyTypes'
import { Studio } from '@/components/Studio'

export default function StudioPage() {
  const router = useRouter()
  const [data, setData] = useState<ActivityStoryData | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('trailstories_data')
    if (!raw) { router.replace('/'); return }
    try {
      setData(JSON.parse(raw) as ActivityStoryData)
    } catch {
      router.replace('/')
    }
  }, [router])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-dvh text-white/30 text-sm">
        Načítám…
      </div>
    )
  }

  return <Studio data={data} />
}
