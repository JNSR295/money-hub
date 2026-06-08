import React, { useState } from 'react';
import axios from 'axios';
import { Wallet, ShieldCheck, Mail, Lock, KeyRound } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: { email: string; twoFactorEnabled: boolean }) => void;
}

function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Frontend Password Complexity Validation: at least 8 chars, 1 uppercase, 1 digit, 1 special char
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(password)) {
          setMessage({
            text: 'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character.',
            isError: true
          });
          setIsLoading(false);
          return;
        }

        // Register API with firstName and lastName
        await axios.post('/api/register', { email, password, firstName, lastName });
        setMessage({ text: 'Registration successful! Please log in.', isError: false });
        setIsRegistering(false);
        setPassword('');
        setFirstName('');
        setLastName('');
      } else {
        // Login API
        const response = await axios.post('/api/login', { email, password });
        if (response.data.twoFactorRequired) {
          setShow2FA(true);
        } else {
          onLoginSuccess(response.data.user);
        }
      }
    } catch (error: any) {
      setMessage({
        text: error.response?.data?.error || 'Authentication failed. Please try again.',
        isError: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await axios.post('/api/login/2fa', { token: twoFactorToken });
      onLoginSuccess(response.data.user);
    } catch (error: any) {
      setMessage({
        text: error.response?.data?.error || 'Invalid 2FA code.',
        isError: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: '#060913',
      backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 60%)'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        position: 'relative'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-2px',
          left: '20%',
          right: '20%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #6366f1, #0ea5e9, transparent)',
          filter: 'blur(1px)'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
          }}>
            <Wallet size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'Outfit' }}>WealthHub</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '6px' }}>
            {show2FA ? 'Verification Required' : 'Personal Wealth Orchestrator'}
          </p>
        </div>

        {message && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: message.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${message.isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
            color: message.isError ? '#ef4444' : '#10b981',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {message.text}
          </div>
        )}

        {/* 2FA Token Step */}
        {show2FA ? (
          <form onSubmit={handle2FAVerify}>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={14} />
                Enter 2FA Code
              </label>
              <input
                type="text"
                placeholder="6-digit verification code"
                className="form-input"
                value={twoFactorToken}
                onChange={(e) => setTwoFactorToken(e.target.value)}
                maxLength={6}
                required
                style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '18px', fontWeight: 'bold' }}
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify & Access'}
            </button>
            
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ width: '100%', marginTop: '12px', border: 'none', background: 'transparent' }}
              onClick={() => {
                setShow2FA(false);
                setTwoFactorToken('');
                setMessage(null);
              }}
              disabled={isLoading}
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth}>
            {isRegistering && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    placeholder="Jed"
                    className="form-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    placeholder="User"
                    className="form-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} />
                Email Address
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={14} />
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading}>
              {isLoading 
                ? (isRegistering ? 'Registering...' : 'Authenticating...') 
                : (isRegistering ? 'Register Account' : 'Sign In')
              }
            </button>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setMessage(null);
                  setPassword('');
                  setFirstName('');
                  setLastName('');
                }}
                disabled={isLoading}
              >
                {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;
