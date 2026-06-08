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
    return localStorage.getItem('money-hub-theme') || 'light';
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

  // Manual Accounts state
  const [manualAccounts, setManualAccounts] = useState<any[]>([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccProvider, setNewAccProvider] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccInterestRate, setNewAccInterestRate] = useState('');
  const [newAccType, setNewAccType] = useState('savings');

  useEffect(() => {
    fetchSettingsAndStatus();
    checkUrlParams();
    fetchManualAccounts();
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
      if (statusRes.data.truelayerClientId) setTruelayerClientId(statusRes.data.truelayerClientId);
      if (statusRes.data.truelayerClientSecret) setTruelayerClientSecret(statusRes.data.truelayerClientSecret);
      if (statusRes.data.trading212Key) setTrading212Key(statusRes.data.trading212Key);
      if (statusRes.data.paypalClientId) setPaypalId(statusRes.data.paypalClientId);
      if (statusRes.data.paypalSecret) setPaypalSecret(statusRes.data.paypalSecret);
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
          redirectUri: window.location.origin // matches current page
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
      
      setMessage({ text: 'API Credentials stored successfully.', isError: false });
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
      const redirectUrl = window.location.origin;
      const response = await axios.get(`/api/truelayer/connect?redirect_uri=${encodeURIComponent(redirectUrl)}`);
      // Redirect to TrueLayer OAuth page
      window.location.href = response.data.authUrl;
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'TrueLayer client credentials must be configured first.', isError: true });
    }
  };

  const fetchManualAccounts = async () => {
    try {
      const response = await axios.get('/api/manual-accounts');
      setManualAccounts(response.data);
    } catch (err) {
      console.error('Failed to fetch manual accounts:', err);
    }
  };

  const handleAddManualAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccProvider || !newAccBalance) return;
    setIsSavingManual(true);
    setMessage(null);
    try {
      await axios.post('/api/manual-accounts', {
        name: newAccName,
        provider: newAccProvider,
        balance: parseFloat(newAccBalance),
        type: newAccType,
        interest_rate: parseFloat(newAccInterestRate) || 0.00
      });
      setNewAccName('');
      setNewAccProvider('');
      setNewAccBalance('');
      setNewAccInterestRate('');
      setNewAccType('savings');
      setMessage({ text: 'Manual account added successfully.', isError: false });
      fetchManualAccounts();
      onUserUpdate();
    } catch (err) {
      setMessage({ text: 'Failed to add manual account.', isError: true });
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleDeleteManualAccount = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    setMessage(null);
    try {
      await axios.delete(`/api/manual-accounts/${id}`);
      setMessage({ text: 'Manual account deleted successfully.', isError: false });
      fetchManualAccounts();
      onUserUpdate();
    } catch (err) {
      setMessage({ text: 'Failed to delete manual account.', isError: true });
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
              <div 
                className={`theme-card ${activeTheme === 'light' ? 'active' : ''}`}
                onClick={() => changeTheme('light')}
              >
                <div className="theme-dot" style={{ background: 'linear-gradient(135deg, #f3f4f6, #ffffff)', border: '1px solid #d1d5db' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Light Mode</span>
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
            API Vault Credentials
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
                    type="text" 
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
                    type="text" 
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
              Save API Vault
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
                Connect your financial providers above to see live data on your dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Accounts Section */}
      <div className="glass-panel" style={{ padding: '24px', marginTop: '30px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Settings size={16} color="#10b981" />
            Manual Accounts & Custom Assets (e.g. Cash ISA)
          </h3>
        </div>
        
        <div className="grid-2" style={{ gap: '30px', marginTop: '15px' }}>
          {/* List of existing manual accounts */}
          <div>
            <h4 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '14px' }}>Current Custom Accounts</h4>
            {manualAccounts.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '13px', padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                No manual accounts configured. Add your Cash ISA or manual savings on the right!
              </div>
            ) : (
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', textAlign: 'left' }}>
                      <th style={{ padding: '10px 8px' }}>Account Name</th>
                      <th style={{ padding: '10px 8px' }}>Provider</th>
                      <th style={{ padding: '10px 8px' }}>Type</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Interest Rate</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Balance</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualAccounts.map(acc => (
                      <tr key={acc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 8px', color: 'white', fontWeight: '500' }}>{acc.name}</td>
                        <td style={{ padding: '10px 8px', color: '#9ca3af' }}>{acc.provider}</td>
                        <td style={{ padding: '10px 8px', color: '#9ca3af', textTransform: 'capitalize' }}>
                          {acc.type === 'current' ? 'Current' : acc.type === 'savings' ? 'Savings' : acc.type === 'investments' ? 'Investments' : 'Pension'}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#10b981' }}>
                          {acc.interestRate && acc.interestRate > 0 ? `${acc.interestRate}% APR` : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>
                          £{acc.balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button 
                            type="button"
                            className="logout-btn" 
                            style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => handleDeleteManualAccount(acc.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Manual Account Form */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '14px' }}>Add Custom Account</h4>
            <form onSubmit={handleAddManualAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Cash ISA"
                  value={newAccName} 
                  onChange={(e) => setNewAccName(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Provider Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Trading 212"
                  value={newAccProvider} 
                  onChange={(e) => setNewAccProvider(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Current Balance (£)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input" 
                  placeholder="e.g. 5000.00"
                  value={newAccBalance} 
                  onChange={(e) => setNewAccBalance(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Annual Interest Rate (% APR, Optional)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input" 
                  placeholder="e.g. 5.20"
                  value={newAccInterestRate} 
                  onChange={(e) => setNewAccInterestRate(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select 
                  className="form-input" 
                  style={{ backgroundColor: '#0b0f19', color: 'white' }}
                  value={newAccType} 
                  onChange={(e) => setNewAccType(e.target.value)}
                  required
                >
                  <option value="savings" style={{ backgroundColor: '#0b0f19' }}>Savings Account</option>
                  <option value="investments" style={{ backgroundColor: '#0b0f19' }}>Investments</option>
                  <option value="current" style={{ backgroundColor: '#0b0f19' }}>Current Account</option>
                  <option value="pension" style={{ backgroundColor: '#0b0f19' }}>Pension Pot</option>
                </select>
              </div>
              
              <button type="submit" className="btn-primary" style={{ marginTop: '8px', padding: '10px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} disabled={isSavingManual}>
                <Save size={16} />
                Add Account
              </button>
            </form>
          </div>
        </div>
      </div>

    </div>
  );
}

export default ConfigScreen;
