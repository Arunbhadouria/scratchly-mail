import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { Mail, Lock, ShieldCheck, User, Building, ArrowRight, AlertCircle, Sun, Moon } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme, playHapticClick } = useTheme();
  const [isRegister, setIsRegister] = useState(false);

  const [form, setForm] = useState({
    email: 'admin@scratchly.local',
    password: 'ScratchlyAdmin123!',
    name: 'Jordan Mitchell',
    tenantName: 'Acme Growth Labs',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playHapticClick();
    setLoading(true);
    setError(null);

    if (isRegister) {
      const res = await api.post<{ token: string; user: any }>('/auth/register', form);
      if (res.success && res.data) {
        api.setToken(res.data.token);
        window.location.reload();
      } else {
        setError(res.error || 'Registration failed');
        setLoading(false);
      }
    } else {
      const res = await login(form.email, form.password);
      setLoading(false);
      if (!res.success) {
        setError(res.error || 'Invalid email or password');
      }
    }
  };

  const fillDemoCredentials = () => {
    playHapticClick();
    setIsRegister(false);
    setForm({
      email: 'admin@scratchly.local',
      password: 'ScratchlyAdmin123!',
      name: 'Jordan Mitchell',
      tenantName: 'Acme Growth Labs',
    });
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-200">
      {/* Subtle Background Glow Accent (from scratchlycrm.app) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-scratchly-100/60 dark:bg-scratchly-900/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2.5 rounded-full bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-ink-900 dark:hover:text-white shadow-subtle transition-all"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        {/* Official Brand Logo */}
        <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white dark:bg-ink-800 border border-slate-200/90 dark:border-slate-700 shadow-card mb-4 transform hover:scale-105 transition-transform duration-200">
          <img
            src="https://res.cloudinary.com/dch4tdddp/image/upload/v1769509934/logo_mv6mmf.png"
            alt="Scratchly CRM Logo"
            className="w-12 h-12 object-contain rounded-xl"
          />
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">
            Scratchly <span className="text-scratchly-600 font-extrabold">Mail</span>
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-scratchly-50 text-scratchly-700 dark:bg-scratchly-900/60 dark:text-scratchly-300 border border-scratchly-200 dark:border-scratchly-800">
            v1.0
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
          Intelligent automation meets simple design. Zero clutter, pure focus.
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-3 xs:px-4 sm:px-0">
        <div className="bg-white dark:bg-ink-800 py-6 sm:py-8 px-4 sm:px-10 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-700/80 shadow-floating">
          {/* Mockup Window Traffic Lights */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700/60 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            </div>
            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
              Scratchly Mail › {isRegister ? 'Create Account' : 'Sign In'}
            </span>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Your Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Jordan Mitchell"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Workspace / Organization Name</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={form.tenantName}
                      onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                      placeholder="Acme Growth Labs"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@scratchly.local"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-900 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-slate-700 text-ink-900 dark:text-white text-xs font-medium focus:outline-none focus:border-scratchly-600 focus:ring-1 focus:ring-scratchly-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-scratchly-600 hover:bg-scratchly-700 text-white text-xs font-bold shadow-sm hover:shadow-glow-blue transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : isRegister ? 'Create Workspace' : 'Sign In to Workspace'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Button */}
          {!isRegister && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/80 text-center">
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="w-full py-2.5 px-3 rounded-xl bg-scratchly-50 hover:bg-scratchly-100 dark:bg-scratchly-950/40 dark:hover:bg-scratchly-900/50 border border-scratchly-200 dark:border-scratchly-800 text-xs font-bold text-scratchly-700 dark:text-scratchly-300 transition-colors cursor-pointer"
              >
                Sign In with Demo Account
              </button>
            </div>
          )}

          {/* Toggle Register/Login */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                playHapticClick();
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-scratchly-600 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              {isRegister
                ? 'Already have an account? Sign In'
                : "Don't have a workspace? Create one"}
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Enterprise-grade security &bull; Private &amp; encrypted</span>
        </div>
      </div>
    </div>
  );
};
