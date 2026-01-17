import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function createPageUrl(pageName) {
  const routes = {
    Home: '/',
    Schedule: '/schedule',
    Profile: '/profile',
    Admin: '/admin',
    Login: '/login',
    Register: '/register',
  };
  return routes[pageName] || '/';
}
