import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
export function AuthPanel() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true); setError('')
    try {
      const result = await supabase.auth.signInWithPassword({ email: String(values.get('email')).trim(), password: String(values.get('password')) })
      if (result.error) setError('Sign-in failed. Check your credentials or contact the vault owner.')
    } catch { setError('Unable to reach the authentication service. Please try again.') }
    finally { form.reset(); setBusy(false) }
  }
  return <main id="main-content" className="entry auth-entry"><LockKeyhole size={28} className="auth-lock" /><h1>For the invited.</h1><p>Sign in to your approved investor account.</p>
    {!supabase ? <p role="alert" className="notice">Secure mode is not configured. The vault remains closed.</p> : <form className="auth-form" onSubmit={submit}><label>Email address<input type="email" name="email" autoComplete="username" required /></label><label>Password<input type="password" name="password" autoComplete="current-password" required minLength={8} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button></form>}
    <p className="entry-note">INVITATION REQUIRED · PRIVATE ACCESS</p>
  </main>
}
