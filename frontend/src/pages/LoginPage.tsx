import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { UserProfile } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    // Check URL parameters for OAuth errors
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const msg = params.get('msg');
    if (error === 'domain_unauthorized') {
      setErrorMessage(msg || 'Access denied: Only @ssn.edu.in accounts are permitted.');
    } else if (error) {
      setErrorMessage(msg || 'Authentication failed. Please try again.');
    }

    // Check dev mode availability
    api.getGoogleLoginUrl().then((res) => {
      if (res.dev_mode) {
        setDevMode(true);
      }
    }).catch(() => {});
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getGoogleLoginUrl();
      if (res.auth_url) {
        window.location.href = res.auth_url;
      } else if (res.dev_mode) {
        // Fallback to dev mock login
        const loginRes = await api.mockLogin();
        if (loginRes.token) {
          localStorage.setItem('markme_token', loginRes.token);
        }
        onLoginSuccess(loginRes.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Google login.');
      setLoading(false);
    }
  };

  const handleDevMockLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const loginRes = await api.mockLogin();
      if (loginRes.token) {
        localStorage.setItem('markme_token', loginRes.token);
      }
      onLoginSuccess(loginRes.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Mock login failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Institutional Branding Top */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 text-center text-white relative">
          <div className="w-36 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
            <span className="text-3xl font-extrabold text-white">MarkMe</span>
          </div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-blue-300">
            COLLEGE ATTENDANCE SYSTEM
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Sri Sivasubramaniya Nadar College of Engineering
          </p>
        </div>

        {/* Action Body */}
        <div className="p-8 space-y-6">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-semibold">Access Restriction</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm shadow-sm transition hover:shadow duration-150 disabled:opacity-50"
            >
              {/* Google SVG Logo */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>

            {devMode && (
              <button
                onClick={handleDevMockLogin}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 font-medium text-xs transition"
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Quick Sign In: faculty@ssn.edu.in (Dev Mode)</span>
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 text-center space-y-1">
            <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Only <span className="font-semibold text-slate-700">@ssn.edu.in</span> accounts are permitted.</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sign-in is remembered on this device for 30 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
