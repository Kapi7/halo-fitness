import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (localStorage.getItem('halo_token')) {
        const userData = await api.me();
        setUser(userData);
      }
    } catch (error) {
      console.log('Not authenticated');
      api.logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    return data;
  };

  const register = async (email, password, firstName, lastName, phoneNumber) => {
    const data = await api.register(email, password, firstName, lastName, phoneNumber);
    setUser(data.user);
    return data;
  };

  const loginWithGoogle = async () => {
    const { url } = await api.getGoogleAuthUrl();
    window.location.href = url;
  };

  const handleGoogleCallback = async (code) => {
    const data = await api.googleCallback(code);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
  };

  const adminEmails = ['hilada89@gmail.com', 'kapoosha@gmail.com'];
  const isAdmin = adminEmails.includes(user?.email?.toLowerCase()?.trim());

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithGoogle,
        handleGoogleCallback,
        logout,
        updateUser,
        isAdmin,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
