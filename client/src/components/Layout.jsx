import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, LogOut, Calendar, Settings, Instagram, Menu, X, MessageCircle } from 'lucide-react';

export default function Layout({ children }) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const NavLink = ({ to, icon: Icon, children, onClick }) => (
    <Link
      to={to}
      onClick={onClick}
      className={`text-sm font-medium transition-colors hover:text-halo-pink flex items-center gap-2 ${
        location.pathname === to ? 'text-halo-pink' : 'text-slate-600'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-light tracking-wider text-slate-900">
              HALO <span className="text-halo-pink font-semibold">FITNESS</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/schedule" icon={Calendar}>Schedule</NavLink>

            {isAuthenticated ? (
              <>
                <NavLink to="/profile" icon={User}>Profile</NavLink>
                {isAdmin && <NavLink to="/admin" icon={Settings}>Admin</NavLink>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Logout
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="bg-halo-pink hover:bg-halo-pink-dark">Sign Up</Button>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-slate-600 hover:text-slate-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white">
            <div className="px-4 py-4 space-y-4">
              <NavLink to="/schedule" icon={Calendar} onClick={() => setMobileMenuOpen(false)}>
                Schedule
              </NavLink>

              {isAuthenticated ? (
                <>
                  <NavLink to="/profile" icon={User} onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </NavLink>
                  {isAdmin && (
                    <NavLink to="/admin" icon={Settings} onClick={() => setMobileMenuOpen(false)}>
                      Admin
                    </NavLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">Login</Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-halo-pink hover:bg-halo-pink-dark">Sign Up</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/35796326140"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110"
        title="Chat on WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
      </a>

      <footer className="border-t border-slate-100 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} Halo Fitness. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://www.instagram.com/halo_fitness_limassol"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-500 hover:text-halo-pink transition-colors"
              >
                <Instagram className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">@halo_fitness_limassol</span>
              </a>
              <a
                href="https://wa.me/35796326140"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-500 hover:text-green-500 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
