import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const { handleGoogleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Google sign-in was cancelled');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    if (!code) {
      setError('No authorization code received');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    const authenticate = async () => {
      try {
        await handleGoogleCallback(code);
        toast.success('Welcome to Halo Fitness!');
        navigate('/schedule');
      } catch (err) {
        console.error('Google auth error:', err);
        setError(err.message || 'Authentication failed');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    authenticate();
  }, [searchParams, handleGoogleCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-red-500 mb-4">{error}</div>
        <div className="text-slate-500 text-sm">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-halo-pink mb-4" />
      <div className="text-slate-600">Completing sign in...</div>
    </div>
  );
}
