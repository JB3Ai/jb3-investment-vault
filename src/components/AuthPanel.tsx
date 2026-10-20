import { LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Removing the password UI never substitutes the presentation PIN for Auth.
export function AuthPanel() {
  return <main id="main-content" className="entry auth-entry">
    <LockKeyhole size={28} className="auth-lock" />
    <h1>Private access pending.</h1>
    <p>An approved investor session is required to open this presentation.</p>
    {!supabase
      ? <p role="alert" className="notice">Secure mode is not configured. The vault remains closed.</p>
      : <p role="status" className="notice">Please contact the Vault owner to arrange private access.</p>}
    <p className="entry-note">INVITATION REQUIRED · PRIVATE ACCESS</p>
  </main>
}
