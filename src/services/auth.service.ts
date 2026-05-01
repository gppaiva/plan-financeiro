import { supabase } from '../lib/supabase'
import type { AuthResult, Session } from '../types'

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return {
    session: data.session,
    user: data.user,
    error: error?.message ?? null,
  }
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
  username?: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome: name, username: username || null },
    },
  })

  return {
    session: data.session,
    user: data.user,
    error: error?.message ?? null,
  }
}

/**
 * Look up the email associated with a username via a public RPC function.
 * Uses SECURITY DEFINER on the DB side so it works before authentication.
 */
export async function getEmailByUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_email_by_username', {
    p_username: username,
  })
  if (error || !data) return null
  return data as string
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return { unsubscribe: data.subscription.unsubscribe }
}
