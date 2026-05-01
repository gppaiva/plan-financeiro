// Biometric unlock service using WebAuthn (Web Authentication API)
// Used as a device-level unlock for users who already have an active Supabase session.
// WebAuthn requires HTTPS in production — it works on localhost for development.

/** Check if WebAuthn is available on this device */
export function isBiometricAvailable(): boolean {
  return !!window.PublicKeyCredential
}

/** Check if user has enabled biometric unlock */
export function isBiometricEnabled(): boolean {
  return localStorage.getItem('biometric_enabled') === 'true'
}

/** Enable biometric — register a credential */
export async function enableBiometric(): Promise<boolean> {
  // Create a simple challenge (we're using this as device unlock, not server auth)
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Plan Financeiro', id: window.location.hostname },
        user: {
          id: userId,
          name: 'user@planfinanceiro',
          displayName: 'Plan Financeiro User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Use device biometric (not USB key)
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })

    if (credential) {
      // Store the credential ID for later authentication
      const credId = btoa(
        String.fromCharCode(...new Uint8Array((credential as PublicKeyCredential).rawId)),
      )
      localStorage.setItem('biometric_credential_id', credId)
      localStorage.setItem('biometric_enabled', 'true')
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Authenticate with biometric */
export async function authenticateBiometric(): Promise<boolean> {
  const credIdB64 = localStorage.getItem('biometric_credential_id')
  if (!credIdB64) return false

  const credIdBytes = Uint8Array.from(atob(credIdB64), (c) => c.charCodeAt(0))
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: credIdBytes,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })

    return !!assertion
  } catch {
    return false
  }
}

/** Disable biometric */
export function disableBiometric(): void {
  localStorage.removeItem('biometric_enabled')
  localStorage.removeItem('biometric_credential_id')
}
