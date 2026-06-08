import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings, 
  Key, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Link2, 
  Save, 
  Info
} from 'lucide-react';

interface User {
  email: string;
  twoFactorEnabled: boolean;
}

interface ConfigScreenProps {
  user: User;
  onUserUpdate: () => void;
}

function ConfigScreen({ user, onUserUpdate }: ConfigScreenProps) {
  // Settings state
  const [baselineIncome, setBaselineIncome] = useState('');
  const [currentAge, setCurrentAge] = useState('');
  const [retirementAge, setRetirementAge] = useState('');
  const [pensionPot, setPensionPot] = useState('');
  const [pensionContribution, setPensionContribution] = useState('');
  const [pensionGrowthRate, setPensionGrowthRate] = useState(5.0);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    return localStorage.getItem('money-hub-theme') || 'dark-neon';
  });

  // Credentials state
  const [truelayerClientId, setTruelayerClientId] = useState('');
  const [truelayerClientSecret, setTruelayerClientSecret] = useState('');
  const [trading212Key, setTrading212Key] = useState('');
  const [paypalId, setPaypalId] = useState('');
  const [paypalSecret, setPaypalSecret] = useState('');
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  // Status flags
  const [status, setStatus] = useState({
    truelayerConfigured: false,
    truelayerConnected: false,
    trading212Configured: false,
    paypalConfigured: false
  });

  // 2FA state
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [tempSecret, setTempSecret] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [is2faSetupActive, setIs2faSetupActive] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    fetchSettingsAndStatus();
    checkUrlParams();
  }, []);

  const fetchSettingsAndStatus = async () => {
    try {
      // Fetch settings
      const settingsRes = await axios.get('/api/config/settings');
      setBaselineIncome(settingsRes.data.baselineIncome.toString());
      setCurrentAge(settingsRes.data.currentAge.toString());
      setRetirementAge(settingsRes.data.retirementAge.toString());
      setPensionPot(settingsRes.data.pensionPot.toString());
      setPensionContribution(settingsRes.data.pensionContribution.toString());
      setPensionGrowthRate(settingsRes.data.pensionGrowthRate);

      // Fetch credentials status
      const statusRes = await axios.get('/api/config/credentials');
      setStatus(statusRes.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Check if we came back from TrueLayer redirect
  const checkUrlParams = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code) {
      // Clear query params immediately for visual cleanliness
      window.history.replaceState({}, document.title, window.location.pathname);
      setMessage({ text: 'Exchanging TrueLayer authorization code...', isError: false });
      
      try {
        await axios.post('/api/truelayer/callback', {
          code,
          redirectUri: window.location.origin + '/settings' // matches current page
        });
        setMessage({ text: 'TrueLayer banking linked successfully!', isError: false });
        fetchSettingsAndStatus();
      } catch (err: any) {
        setMessage({ text: err.response?.data?.error || 'Failed to complete TrueLayer link.', isError: true });
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setMessage(null);
    try {
      await axios.post('/api/config/settings', {
        baseline_income: parseFloat(baselineIncome),
        current_age: parseInt(currentAge),
        retirement_age: parseInt(retirementAge),
        pension_pot: parseFloat(pensionPot),
        pension_contribution: parseFloat(pensionContribution),
        pension_growth_rate: pensionGrowthRate
      });
      setMessage({ text: 'Parameters saved successfully.', isError: false });
    } catch (err) {
      setMessage({ text: 'Failed to update parameters.', isError: true });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const changeTheme = (themeName: string) => {
    setActiveTheme(themeName);
    localStorage.setItem('money-hub-theme', themeName);
    
    // Apply class to body
    document.body.className = '';
    if (themeName !== 'dark-neon') {
      document.body.classList.add(`theme-${themeName}`);
    }
  };

  const handleSaveCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCreds(true);
    setMessage(null);
    try {
      await axios.post('/api/config/credentials', {
        truelayer_client_id: truelayerClientId || undefined,
        truelayer_client_secret: truelayerClientSecret || undefined,
        trading212_api_key: trading212Key || undefined,
        paypal_client_id: paypalId || undefined,
        paypal_client_secret: paypalSecret || undefined
      });
      
      setTruelayerClientId('');
      setTruelayerClientSecret('');
      setTrading212Key('');
      setPaypalId('');
      setPaypalSecret('');
      
      setMessage({ text: 'API Credentials stored and encrypted.', isError: false });
      fetchSettingsAndStatus();
    } catch (err) {
      setMessage({ text: 'Failed to store credentials.', isError: true });
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleTrueLayerConnect = async () => {
    setMessage(null);
    try {
      const response = await axios.get(`/api/truelayer/connect?redirect_uri=${encodeURIComponent(window.location.href)}`);
      // Redirect to TrueLayer OAuth page
      window.location.href = response.data.authUrl;
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'TrueLayer client credentials must be configured first.', isError: true });
    }
  };

  const start2faSetup = async () => {
    setMessage(null);
    try {
      const response = await axios.post('/api/2fa/setup');
      setQrCodeUrl(response.data.qrCode);
      setTempSecret(response.data.secret);
      setIs2faSetupActive(true);
    } catch (err) {
      setMessage({ text: 'Failed to initiate 2FA setup.', isError: true });
    }
  };

  const verify2faToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await axios.post('/api/2fa/verify', { token: twoFactorToken });
      setIs2faSetupActive(false);
      setQrCodeUrl(null);
      setTwoFactorToken('');
      setMessage({ text: 'TOTP 2FA enabled successfully!', isError: false });
      onUserUpdate();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Invalid 2FA token.', isError: true });
    }
  };

  const disable2fa = async () => {
    if (!window.confirm('Are you sure you want to disable Two-Factor Authentication?')) return;
    setMessage(null);
    try {
      await axios.post('/api/2fa/disable');
      setMessage({ text: '2FA has been disabled.', isError: false });
      onUserUpdate();
    } catch (err) {
      setMessage({ text: 'Failed to disable 2FA.', isError: true });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {message && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '12px',
          backgroundColor: message.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${message.isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
          color: message.isError ? '#ef4444' : '#10b981',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message.isError ? <XCircle size={18} /> : <CheckCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="grid-2">
        {/* Baseline & Pension configurations */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Settings size={16} color="#6366f1" />
              Wealth & Pension Parameters
            </h3>
          </div>
          
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Baseline Net Monthly Income (£)</label>
              <input 
                type="number" 
                className="form-input" 
                value={baselineIncome} 
                onChange={(e) => setBaselineIncome(e.target.value)} 
                required 
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Current Age</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={currentAge} 
                  onChange={(e) => setCurrentAge(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Retirement Target Age</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={retirementAge} 
                  onChange={(e) => setRetirementAge(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '4px' }}>
              <h4 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '14px' }}>Pension Predictor Parameters</h4>
              
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Current Pot Value (£)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={pensionPot} 
                    onChange={(e) => setPensionPot(e.target.value)} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Contribution (£)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={pensionContribution} 
                    onChange={(e) => setPensionContribution(e.target.value)} 
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '4px' }}>
                <label className="form-label">Compounding Growth Projection Rate</label>
                <div className="toggle-container">
                  <button 
                    type="button" 
                    className={`toggle-option ${pensionGrowthRate === 3.0 ? 'active' : ''}`}
                    onClick={() => setPensionGrowthRate(3.0)}
                  >
                    3% (Low)
                  </button>
                  <button 
                    type="button" 
                    className={`toggle-option ${pensionGrowthRate === 5.0 ? 'active' : ''}`}
                    onClick={() => setPensionGrowthRate(5.0)}
                  >
                    5% (Med)
                  </button>
                  <button 
                    type="button" 
                    className={`toggle-option ${pensionGrowthRate === 7.0 ? 'active' : ''}`}
                    onClick={() => setPensionGrowthRate(7.0)}
                  >
                    7% (High)
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }} disabled={isSavingSettings}>
              <Save size={16} />
              Save Settings & Re-calculate
            </button>
          </form>
        </div>

        {/* Column 2: 2FA & Appearance Theme Picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* 2FA Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="card-header">
              <h3 className="card-title">
                <ShieldAlert size={16} color="#ef4444" />
                Two-Factor Authentication (2FA)
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' }}>
                Keep your financial API keys and banking parameters secure. Enabling 2FA mandates a 6-digit verification code from your authenticator app (Authy, Google Authenticator) upon login.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>Status:</span>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold', 
                  color: user.twoFactorEnabled ? '#10b981' : '#ef4444',
                  background: user.twoFactorEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '4px'
                }}>
                  {user.twoFactorEnabled ? '2FA ENABLED' : '2FA DISABLED'}
                </span>
              </div>

              {!user.twoFactorEnabled && !is2faSetupActive && (
                <button className="btn-primary" onClick={start2faSetup} style={{ alignSelf: 'flex-start' }}>
                  Setup 2FA
                </button>
              )}

              {user.twoFactorEnabled && (
                <button className="btn-secondary" onClick={disable2fa} style={{ alignSelf: 'flex-start', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                  Disable 2FA
                </button>
              )}

              {is2faSetupActive && qrCodeUrl && (
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px' }}>
                  <img src={qrCodeUrl} alt="2FA QR Code" style={{ border: '4px solid white', borderRadius: '8px', width: '120px', height: '120px' }} />
                  
                  <form onSubmit={verify2faToken} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      Scan this QR code with your authenticator app, then enter the 6-digit code to enable:
                    </span>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input 
                        type="text" 
                        placeholder="e.g. 123456" 
                        className="form-input" 
                        value={twoFactorToken}
                        onChange={(e) => setTwoFactorToken(e.target.value)}
                        maxLength={6}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" className="btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
                        Verify & Enable
                      </button>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ padding: '8px 14px', fontSize: '13px' }}
                        onClick={() => {
                          setIs2faSetupActive(false);
                          setQrCodeUrl(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Theme Picker Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="card-header">
              <h3 className="card-title">
                <Settings size={16} color="#6366f1" />
                Theme & Appearance
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px', lineHeight: '1.4' }}>
              Customize your Money Hub dashboard theme. Select a preset color palette below.
            </p>
            <div className="theme-picker-container">
              <div 
                className={`theme-card ${activeTheme === 'dark-neon' ? 'active' : ''}`}
                onClick={() => changeTheme('dark-neon')}
              >
                <div className="theme-dot" style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Dark Neon</span>
              </div>
              <div 
                className={`theme-card ${activeTheme === 'midnight-blue' ? 'active' : ''}`}
                onClick={() => changeTheme('midnight-blue')}
              >
                <div className="theme-dot" style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Midnight Blue</span>
              </div>
              <div 
                className={`theme-card ${activeTheme === 'forest-green' ? 'active' : ''}`}
                onClick={() => changeTheme('forest-green')}
              >
                <div className="theme-dot" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Forest Green</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Configuration & Credentials Vault */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Key size={16} color="#f59e0b" />
            API Vault Credentials (AES-256-GCM Encrypted)
          </h3>
        </div>

        <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
          {/* Key Form */}
          <form onSubmit={handleSaveCreds} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              <h4 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>1. TrueLayer Open Banking API (UK)</h4>
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Client ID</label>
                  <input 
                    type="password" 
                    placeholder="truelayer-client-id" 
                    className="form-input"
                    value={truelayerClientId}
                    onChange={(e) => setTruelayerClientId(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Client Secret</label>
                  <input 
                    type="password" 
                    placeholder="••••••••••••" 
                    className="form-input"
                    value={truelayerClientSecret}
                    onChange={(e) => setTruelayerClientSecret(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              <h4 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>2. Trading 212 API</h4>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Personal Read-Only API Key</label>
                <input 
                  type="password" 
                  placeholder="Trading212 API Key" 
                  className="form-input"
                  value={trading212Key}
                  onChange={(e) => setTrading212Key(e.target.value)}
                />
              </div>
            </div>

            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              <h4 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>3. PayPal REST API</h4>
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Client ID</label>
                  <input 
                    type="password" 
                    placeholder="paypal-client-id" 
                    className="form-input"
                    value={paypalId}
                    onChange={(e) => setPaypalId(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Client Secret</label>
                  <input 
                    type="password" 
                    placeholder="••••••••••••" 
                    className="form-input"
                    value={paypalSecret}
                    onChange={(e) => setPaypalSecret(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '10px' }} disabled={isSavingCreds}>
              <Save size={16} />
              Encrypt & Save API Vault
            </button>
          </form>

          {/* Connection status and links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '14px' }}>Vault Configuration Status</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span>TrueLayer API Keys:</span>
                  <span style={{ color: status.truelayerConfigured ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                    {status.truelayerConfigured ? 'Saved' : 'Not Set'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span>TrueLayer OAuth Link:</span>
                  <span style={{ color: status.truelayerConnected ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                    {status.truelayerConnected ? 'Linked' : 'Not Linked'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span>Trading212 API Key:</span>
                  <span style={{ color: status.trading212Configured ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                    {status.trading212Configured ? 'Saved' : 'Not Set'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span>PayPal REST Keys:</span>
                  <span style={{ color: status.paypalConfigured ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                    {status.paypalConfigured ? 'Saved' : 'Not Set'}
                  </span>
                </div>
              </div>
            </div>

            {status.truelayerConfigured && (
              <button className="btn-primary" onClick={handleTrueLayerConnect} style={{ width: '100%' }}>
                <Link2 size={16} />
                {status.truelayerConnected ? 'Reconnect TrueLayer Auth' : 'Connect TrueLayer Auth'}
              </button>
            )}

            <div style={{ display: 'flex', gap: '8px', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
              <Info size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.4' }}>
                <strong>Demo Mode Active:</strong> If any API vault credentials are left empty, the application automatically displays simulated sandboxed values so you can test the charts and timeline instantly!
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default ConfigScreen;
