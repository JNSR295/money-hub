import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, 
  CreditCard, 
  PiggyBank, 
  CalendarDays, 
  Settings, 
  LogOut,
  Wallet,
  ShieldCheck
} from 'lucide-react';

// Import Screens
import DashboardScreen from './screens/DashboardScreen';
import DebtScreen from './screens/DebtScreen';
import AccountsScreen from './screens/AccountsScreen';
import BudgetScreen from './screens/BudgetScreen';
import ConfigScreen from './screens/ConfigScreen';
import LoginScreen from './screens/LoginScreen';

// Configure Axios defaults for session cookies
axios.defaults.withCredentials = true;
axios.defaults.baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

interface User {
  email: string;
  twoFactorEnabled: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Verify session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await axios.get('/api/me');
      if (response.data.loggedIn) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      setUser(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#060913',
        color: '#9ca3af',
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <p style={{ letterSpacing: '0.05em', fontSize: '14px' }}>Securing Session...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Gatekeeper: Show Login / Registration Screen if not authenticated
  if (!user) {
    return <LoginScreen onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="app-container">
      {/* Header & Sticky Nav */}
      <header className="app-header glass-panel">
        <div className="logo-container">
          <div className="logo-icon">
            <Wallet size={20} color="white" />
          </div>
          <span className="logo-text">WealthHub</span>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'debts' ? 'active' : ''}`}
            onClick={() => setActiveTab('debts')}
          >
            <CreditCard size={16} />
            Debts
          </button>

          <button 
            className={`nav-item ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <PiggyBank size={16} />
            Accounts
          </button>

          <button 
            className={`nav-item ${activeTab === 'budget' ? 'active' : ''}`}
            onClick={() => setActiveTab('budget')}
          >
            <CalendarDays size={16} />
            Budget Matrix
          </button>

          <button 
            className={`nav-item ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Settings size={16} />
            Settings
          </button>
        </nav>

        <div className="user-badge">
          <span style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#10b981" />
            {user.email}
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Log Out
          </button>
        </div>
      </header>

      {/* Screen Render */}
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardScreen />}
        {activeTab === 'debts' && <DebtScreen />}
        {activeTab === 'accounts' && <AccountsScreen />}
        {activeTab === 'budget' && <BudgetScreen />}
        {activeTab === 'config' && <ConfigScreen user={user} onUserUpdate={checkSession} />}
      </main>
    </div>
  );
}

export default App;
