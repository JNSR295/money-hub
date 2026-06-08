import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Wallet, ShieldCheck, Mail, Lock, KeyRound, PiggyBank, Coins } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: { email: string; twoFactorEnabled: boolean }) => void;
}

function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (show2FA) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [show2FA]);

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

  const handle2FAVerify = async (e?: React.FormEvent | string) => {
    if (e && typeof e !== 'string') {
      e.preventDefault();
    }
    setMessage(null);
    setIsLoading(true);

    const code = typeof e === 'string' ? e : otp.join('');
    if (code.length !== 6) {
      setMessage({ text: 'Please enter a 6-digit code.', isError: true });
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post('/api/login/2fa', { token: code });
      onLoginSuccess(response.data.user);
    } catch (error: any) {
      setMessage({
        text: error.response?.data?.error || 'Invalid 2FA code.',
        isError: true
      });
      setOtp(new Array(6).fill(''));
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (element: HTMLInputElement, index: number) => {
    const val = element.value.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = val ? val[val.length - 1] : '';
    setOtp(newOtp);

    // Focus next input
    if (newOtp[index] && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all inputs are filled
    const fullCode = newOtp.join('');
    if (fullCode.length === 6) {
      handle2FAVerify(fullCode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otp];
      if (!newOtp[index]) {
        if (index > 0) {
          newOtp[index - 1] = '';
          setOtp(newOtp);
          inputRefs.current[index - 1]?.focus();
        }
      } else {
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      handle2FAVerify(pastedData);
    } else {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i] || '';
      }
      setOtp(newOtp);
      const nextFocusIdx = Math.min(pastedData.length, 5);
      inputRefs.current[nextFocusIdx]?.focus();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg-main, #060913)',
      backgroundImage: 'radial-gradient(circle at 50% 50%, var(--primary-glow) 0%, transparent 60%)'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border-color)',
        position: 'relative'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-2px',
          left: '20%',
          right: '20%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--primary), var(--secondary), transparent)',
          filter: 'blur(1px)'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Wallet size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'Outfit' }}>Money Hub</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {show2FA ? 'Verification Required' : 'Personal Wealth Tracker'}
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
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginBottom: '12px' }}>
                <KeyRound size={14} />
                Enter 2FA Code
              </label>
              
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '16px 0' }}>
                {otp.map((data, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength={1}
                    value={data}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    onChange={(e) => handleChange(e.target, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    disabled={isLoading}
                    className="form-input otp-input"
                    style={{
                      width: '45px',
                      height: '50px',
                      fontSize: '24px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      outline: 'none',
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                ))}
              </div>
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
                setOtp(new Array(6).fill(''));
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
                    placeholder="First Name"
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
                    placeholder="Last Name"
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
              {isRegistering && password.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: password.length >= 8 ? '#10b981' : 'var(--text-secondary)' }}>
                    {password.length >= 8 ? '✓' : '○'} At least 8 characters
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: /[A-Z]/.test(password) ? '#10b981' : 'var(--text-secondary)' }}>
                    {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: /\d/.test(password) ? '#10b981' : 'var(--text-secondary)' }}>
                    {/\d/.test(password) ? '✓' : '○'} One number
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '#10b981' : 'var(--text-secondary)' }}>
                    {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '✓' : '○'} One special character
                  </div>
                </div>
              )}
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
                  color: 'var(--primary)',
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
