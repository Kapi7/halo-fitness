import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function CalendarCallback() {
  const [searchParams] = useSearchParams();
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
      setError('Calendar connection was cancelled');
      setTimeout(() => navigate('/profile'), 2000);
      return;
    }

    if (!code) {
      setError('No authorization code received');
      setTimeout(() => navigate('/profile'), 2000);
      return;
    }

    const connectCalendar = async () => {
      try {
        await api.calendarCallback(code);
        toast.success('Google Calendar connected! Your bookings will now sync to your calendar.');
        navigate('/profile');
      } catch (err) {
        console.error('Calendar connection error:', err);
        setError(err.message || 'Failed to connect calendar');
        setTimeout(() => navigate('/profile'), 2000);
      }
    };

    connectCalendar();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-red-500 mb-4">{error}</div>
        <div className="text-slate-500 text-sm">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-halo-pink mb-4" />
      <div className="text-slate-600">Connecting your calendar...</div>
    </div>
  );
}
