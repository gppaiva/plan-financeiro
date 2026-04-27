import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types'
import type { ProfileFormData } from '../schemas/profile.schema'

const TABLE = 'user_profiles'

export async function getProfile(authUserId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) {
    // PGRST116 = "no rows returned" — not an error, just no profile yet
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(error.message)
  }

  return data as UserProfile
}

export async function createProfile(
  authUserId: string,
  data: ProfileFormData,
): Promise<UserProfile> {
  // Extract only the fields that exist in the DB table (telefone is not a DB column)
  const { telefone: _telefone, ...dbFields } = data

  const { data: created, error } = await supabase
    .from(TABLE)
    .insert({ auth_user_id: authUserId, ...dbFields })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created as UserProfile
}

export async function updateProfile(
  authUserId: string,
  data: Partial<ProfileFormData>,
): Promise<UserProfile> {
  // Strip telefone since it's not a DB column
  const { telefone: _telefone, ...dbFields } = data

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(dbFields)
    .eq('auth_user_id', authUserId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updated as UserProfile
}

export async function hasCompletedOnboarding(authUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return false
    }
    throw new Error(error.message)
  }

  return data !== null
}
