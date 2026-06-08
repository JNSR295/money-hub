import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  TrendingUp, 
  PiggyBank, 
  Wallet, 
  Percent, 
  Calendar, 
  Save, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';

interface DashboardData {
  netWorth: number;
  breakdown: {
    savings: number;
    current: number;
    debt: number;
    pension: number;
  };
  pensionProjections: {
    growth3pct: number;
    growth5pct: number;
    growth7pct: number;
    targetAge: number;
    yearsRemaining: number;
  };
  assets: Array<{ name: string; provider: string; balance: number; type: string }>;
}

const COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B'];

function DashboardScreen({ onSynced }: { onSynced?: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pension Predictor Inputs
  const [pensionPot, setPensionPot] = useState<number>(0);
  const [pensionContribution, setPensionContribution] = useState<number>(0);
  const [retirementAge, setRetirementAge] = useState<number>(65);
  const [currentAge, setCurrentAge] = useState<number>(30);
  const [selectedGrowthRate, setSelectedGrowthRate] = useState<number>(5.0); // toggle: 3, 5, 7
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch main dashboard data
      const response = await axios.get('/api/dashboard');
      setData(response.data);
      onSynced?.();
      
      // 2. Fetch current user settings to populate inputs
      const settingsResponse = await axios.get('/api/config/settings');
      const settings = settingsResponse.data;
      setPensionPot(settings.pensionPot);
      setPensionContribution(settings.pensionContribution);
      setRetirementAge(settings.retirementAge);
      setCurrentAge(settings.currentAge);
      setSelectedGrowthRate(settings.pensionGrowthRate);
    } catch (err) {
      setError('Unable to connect to bank feeds. Please check your API credentials in Settings.');
      // Since it's zero-retention, fallback is managed server side, but just in case:
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await axios.post('/api/config/settings', {
        pension_pot: pensionPot,
        pension_contribution: pensionContribution,
        retirement_age: retirementAge,
        current_age: currentAge,
        pension_growth_rate: selectedGrowthRate
      });
      // Refresh dashboard calculations
      const response = await axios.get('/api/dashboard');
      setData(response.data);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isLoading && !data) {
    return <div style={{ color: '#9ca3af' }}>Syncing cumulative wealth metrics...</div>;
  }

  const breakdownData = data ? [
    { name: 'Savings Accounts', value: data.breakdown.savings },
    { name: 'Current Accounts', value: data.breakdown.current },
    { name: 'Manual Pension', value: data.breakdown.pension }
  ].filter(item => item.value > 0) : [];

  // Generate coordinates for pension trajectory chart
  const getPensionTrajectory = () => {
    if (!data) return [];
    
    const trajectory = [];
    let currentVal = pensionPot;
    const rate = selectedGrowthRate / 100 / 12; // monthly interest rate
    
    const years = retirementAge - currentAge;
    
    for (let year = 0; year <= years; year++) {
      if (year > 0) {
        // Compound monthly over 12 months
        for (let month = 0; month < 12; month++) {
          currentVal = currentVal * (1 + rate) + pensionContribution;
        }
      }
      
      trajectory.push({
        age: currentAge + year,
        value: parseFloat(currentVal.toFixed(2))
      });
      
      if (year > 40) break; // cap rendering
    }
    
    return trajectory;
  };

  const trajectoryData = getPensionTrajectory();

  // Unified net worth calculation as specified: Savings + Current - Debt
  // (Pension pot value is displayed separately in asset list, or included based on user breakdown)
  const unifiedNetWorth = data ? (data.breakdown.savings + data.breakdown.current - data.breakdown.debt) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 20px',
          borderRadius: '12px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          color: '#f59e0b',
          fontSize: '14px'
        }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Net Worth & Asset Split Grid */}
      <div className="grid-2">
        {/* Net Worth unified card */}
        <div className="glass-panel net-worth-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="net-worth-content">
            <h3 className="net-worth-label">Cumulative Net Worth</h3>
            <div className="net-worth-value">
              £{unifiedNetWorth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            
            <div style={{
              fontSize: '12px',
              fontStyle: 'italic',
              color: '#9ca3af',
              marginTop: '-16px',
              marginBottom: '28px',
              fontFamily: 'monospace'
            }}>
              Formula: Savings (£{(data?.breakdown.savings || 0).toLocaleString()}) + Current (£{(data?.breakdown.current || 0).toLocaleString()}) - Debt (£{(data?.breakdown.debt || 0).toLocaleString()})
            </div>
          </div>

          <div className="breakdown-row" style={{ zIndex: 1 }}>
            <div className="breakdown-item">
              <div className="breakdown-title">Liquid Savings</div>
              <div className="breakdown-val" style={{ color: '#6366F1' }}>
                £{(data?.breakdown.savings || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </div>
            </div>
            
            <div className="breakdown-item">
              <div className="breakdown-title">Current Funds</div>
              <div className="breakdown-val" style={{ color: '#0EA5E9' }}>
                £{(data?.breakdown.current || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-title">Active Debts</div>
              <div className="breakdown-val" style={{ color: '#ef4444' }}>
                -£{(data?.breakdown.debt || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-title">Pension Pot</div>
              <div className="breakdown-val" style={{ color: '#10B981' }}>
                £{(data?.breakdown.pension || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        {/* Asset Allocation Pie chart */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Activity size={16} color="#0ea5e9" />
              Asset Allocation
            </h3>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: '200px' }}>
            <div style={{ width: '50%', height: '100%', minHeight: '200px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={breakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {breakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `£${(value as number).toLocaleString()}`}
                    contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                    itemStyle={{ color: '#ffffff' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {breakdownData.map((entry, index) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: COLORS[index % COLORS.length] }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', color: '#9ca3af' }}>{entry.name}</span>
                    <span style={{ fontSize: '15px', fontWeight: 'bold' }}>£{entry.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pension Predictor Trajectory Section */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <h3 className="card-title">
            <TrendingUp size={16} color="#10b981" />
            Pension Pot Growth Trajectory
          </h3>
          {data && (
            <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 'bold' }}>
              Value at age {retirementAge}: £{(selectedGrowthRate === 3.0 ? data.pensionProjections.growth3pct : selectedGrowthRate === 5.0 ? data.pensionProjections.growth5pct : data.pensionProjections.growth7pct).toLocaleString()}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minHeight: '300px' }}>
          {trajectoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trajectoryData}>
                <defs>
                  <linearGradient id="colorPension" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="age" stroke="#6b7280" style={{ fontSize: '11px' }} />
                <YAxis 
                  stroke="#6b7280" 
                  style={{ fontSize: '11px' }} 
                  tickFormatter={(val) => `£${(val/1000)}k`}
                />
                <Tooltip 
                  formatter={(value) => `£${(value as number).toLocaleString()}`}
                  labelFormatter={(label) => `Age: ${label}`}
                  contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorPension)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px', minHeight: '300px' }}>
              Enter current age and target age to view trajectory graph.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default DashboardScreen;
