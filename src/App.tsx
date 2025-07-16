import React, { useState, useEffect } from 'react';
import Register from './components/Auth/Register';
import Login from './components/Auth/Login';
import OTPVerification from './components/Auth/OTPVerification';
import Dashboard from './components/Dashboard/Dashboard';
import { apiService } from './services/api';
import { User } from './types';

type AuthStep = 'login' | 'register' | 'otp' | 'dashboard';

function App() {
  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState('');
  const [isLoginOTP, setIsLoginOTP] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      apiService.setToken(savedToken);
      loadUserProfile(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUserProfile = async (token: string) => {
    try {
      const profile = await apiService.getProfile();
      setUser(profile);
      setToken(token);
      setAuthStep('dashboard');
    } catch (error) {
      // Token is invalid, clear it
      localStorage.removeItem('token');
      apiService.clearToken();
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSuccess = (data: { userId: string; uniqueId: string }) => {
    setOtpEmail(data.userId); // This should be email, but we'll use userId for now
    setIsLoginOTP(false);
    setAuthStep('otp');
  };

  const handleLoginSuccess = (token: string, user: User) => {
    setToken(token);
    setUser(user);
    setAuthStep('dashboard');
  };

  const handleLoginNeedsOTP = (email: string) => {
    setOtpEmail(email);
    setIsLoginOTP(true);
    setAuthStep('otp');
  };

  const handleOTPSuccess = (token: string, user: User) => {
    setToken(token);
    setUser(user);
    setAuthStep('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    apiService.clearToken();
    setUser(null);
    setToken(null);
    setAuthStep('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  switch (authStep) {
    case 'register':
      return (
        <Register
          onSuccess={handleRegisterSuccess}
          onSwitchToLogin={() => setAuthStep('login')}
        />
      );
    
    case 'login':
      return (
        <Login
          onSuccess={handleLoginSuccess}
          onSwitchToRegister={() => setAuthStep('register')}
          onNeedsOTP={handleLoginNeedsOTP}
        />
      );
    
    case 'otp':
      return (
        <OTPVerification
          email={otpEmail}
          isLogin={isLoginOTP}
          onSuccess={handleOTPSuccess}
          onBack={() => setAuthStep(isLoginOTP ? 'login' : 'register')}
        />
      );
    
    case 'dashboard':
      return user && token ? (
        <Dashboard
          user={user}
          token={token}
          onLogout={handleLogout}
        />
      ) : null;
    
    default:
      return null;
  }
}

export default App;