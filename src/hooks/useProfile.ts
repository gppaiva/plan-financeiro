import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/auth.store'
import { getProfile } from '../services/profile.service'
import type { UserProfile } from '../types'

// Module-level cache
let cachedProfile: UserProfile | null = null
let cachedForUserId: string | null = null
let fetchPromise: Promise<UserProfile | null> | null = null

export function useProfile() {
  const user = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<UserProfile | null>(
    cachedForUserId === user?.id ? cachedProfile : null
  )
  const [loading, setLoading] = useState(
    !(cachedForUserId === user?.id && cachedProfile)
  )

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    // Cache hit
    if (cachedProfile && cachedForUserId === user.id) {
      setProfile(cachedProfile)
      setLoading(false)
      return
    }

    // If already fetching, wait for it
    if (fetchPromise && cachedForUserId === user.id) {
      fetchPromise.then((p) => {
        setProfile(p)
        setLoading(false)
      })
      return
    }

    // Fetch
    setLoading(true)
    cachedForUserId = user.id
    fetchPromise = getProfile(user.id)
      .then((p) => {
        cachedProfile = p
        setProfile(p)
        return p
      })
      .catch(() => {
        setProfile(null)
        return null
      })
      .finally(() => {
        setLoading(false)
        fetchPromise = null
      })
  }, [user])

  return {
    user,
    profile,
    profileId: profile?.id ?? null,
    profileLoading: loading,
  }
}

export function clearProfileCache() {
  cachedProfile = null
  cachedForUserId = null
  fetchPromise = null
}
