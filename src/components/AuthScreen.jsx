import { useState } from 'react';
import { Leaf, Loader2, Eye, EyeOff } from 'lucide-react';
import { signIn, signUp } from '../utils/supabaseClient';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((c) => ({ ...c, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup' && !form.fullName.trim()) {
      setError('Full name is required for sign-up.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: authError } =
        mode === 'login'
          ? await signIn(form.email.trim(), form.password)
          : await signUp(form.email.trim(), form.password, form.fullName.trim());

      if (authError) {
        setError(authError.message);
        return;
      }

      if (mode === 'signup' && !data.session) {
        setError('Check your email to confirm your account, then log in.');
        setMode('login');
        return;
      }

      onAuth(data.session);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-meadow/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest text-3xl shadow-card">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">UrjaGram</h1>
          <p className="mt-1 text-sm text-muted">Village Energy Transition Operating System</p>
        </div>

        <div className="card p-8">
          {/* Tab switcher */}
          <div className="mb-6 flex rounded-card border border-border bg-parchment/60 p-1">
            {['login', 'signup'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setMode(tab); setError(''); }}
                className={`flex-1 rounded-[10px] py-2 text-sm font-semibold transition ${
                  mode === tab ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Full name</label>
                <input
                  className="input-base"
                  name="fullName"
                  type="text"
                  placeholder="Naman Garg"
                  value={form.fullName}
                  onChange={handleChange}
                  autoFocus={mode === 'signup'}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email address</label>
              <input
                className="input-base"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoFocus={mode === 'login'}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  className="input-base pr-11"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-card bg-forest py-3 text-sm font-semibold text-white transition hover:bg-meadow disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted">
            Powered by Supabase Auth · Data encrypted at rest · India data residency
          </p>
        </div>
      </div>
    </div>
  );
}
