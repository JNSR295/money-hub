import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  PiggyBank, 
  Wallet, 
  ArrowUpRight, 
  TrendingUp, 
  Activity,
  Gem
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface AccountItem {
  name: string;
  provider: string;
  balance: number;
  type?: string;
  accountNumber?: string;
  interestRate?: number;
  forecastedInterest?: number;
}

interface AccountsData {
  liquid: AccountItem[];
  growth: AccountItem[];
  liquidTotal: number;
  growthTotal: number;
  forecastedInterestTotal: number;
}

const LIQUID_COLORS = ['#6366F1', '#0EA5E9', '#EC4899'];
const GROWTH_COLORS = ['#10B981', '#F59E0B', '#8B5CF6'];

function AccountsScreen() {
  const [data, setData] = useState<AccountsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountsData();
  }, []);

  const fetchAccountsData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/accounts');
      setData(response.data);
    } catch (err) {
      setError('Stale or unavailable connection to bank feeds.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !data) {
    return <div style={{ color: '#9ca3af' }}>Loading liquidity distribution...</div>;
  }

  const liquidPieData = data ? data.liquid.map(a => ({ name: `${a.provider} (${a.name})`, value: a.balance })) : [];
  const growthPieData = data ? data.growth.map(a => ({ name: `${a.provider} (${a.name})`, value: a.balance })) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Dynamic Summary Cards */}
      <div className="grid-3">
        {/* Liquid total card */}
        <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(14,165,233,0.02))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Liquid Funds</span>
              <div className="metric-value" style={{ fontSize: '32px', color: '#0EA5E9', background: 'none', WebkitTextFillColor: 'initial', marginTop: '6px' }}>
                £{(data?.liquidTotal || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)' }}>
              <Wallet size={20} color="#0ea5e9" />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '14px' }}>
            Available cash in current account
          </div>
        </div>

        {/* Growth total card */}
        <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(245,158,11,0.02))', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Growth Assets</span>
              <div className="metric-value" style={{ fontSize: '32px', color: '#10B981', background: 'none', WebkitTextFillColor: 'initial', marginTop: '6px' }}>
                £{(data?.growthTotal || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)' }}>
              <TrendingUp size={20} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '14px' }}>
            Investments, High-Yield Savings, and Pension accounts compounding
          </div>
        </div>

        {/* Forecasted Interest Card */}
        <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(14,165,233,0.02))', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forecasted Monthly Yield</span>
              <div className="metric-value" style={{ fontSize: '32px', color: '#10B981', background: 'none', WebkitTextFillColor: 'initial', marginTop: '6px' }}>
                £{(data?.forecastedInterestTotal || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)' }}>
              <TrendingUp size={20} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '14px' }}>
            Estimated interest to be earned next month from savings accounts
          </div>
        </div>
      </div>

      {/* Visualization Grid - 2 columns for Liquid and Growth Pie Charts */}
      <div className="grid-2">
        {/* Liquid funds allocation */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Activity size={16} color="#0ea5e9" />
              Liquid Funds Distribution
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', minHeight: '200px' }}>
            <div style={{ width: '50%', height: '100%', minHeight: '200px' }}>
              {liquidPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={liquidPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {liquidPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={LIQUID_COLORS[index % LIQUID_COLORS.length]} />
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
              ) : (
                <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>No accounts to chart</div>
              )}
            </div>
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data?.liquid.map((acc, index) => (
                <div key={acc.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: LIQUID_COLORS[index % LIQUID_COLORS.length] }} />
                    <span style={{ color: '#9ca3af' }}>{acc.provider} ({acc.accountNumber})</span>
                  </div>
                  <span style={{ fontWeight: 'bold' }}>£{acc.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Growth assets allocation */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Gem size={16} color="#10b981" />
              Growth Assets Distribution
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', minHeight: '200px' }}>
            <div style={{ width: '50%', height: '100%', minHeight: '200px' }}>
              {growthPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={growthPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {growthPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={GROWTH_COLORS[index % GROWTH_COLORS.length]} />
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
              ) : (
                <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>No assets to chart</div>
              )}
            </div>
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data?.growth.map((acc, index) => (
                <div key={acc.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: GROWTH_COLORS[index % GROWTH_COLORS.length] }} />
                    <span style={{ color: '#9ca3af' }}>{acc.provider}</span>
                  </div>
                  <span style={{ fontWeight: 'bold' }}>£{acc.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List Grid */}
      <div className="grid-2">
        {/* Liquid funds list */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={16} color="#0ea5e9" />
            Liquid Accounts (Current)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data?.liquid.map(acc => (
              <div key={acc.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{acc.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{acc.provider} • {acc.accountNumber}</div>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#0ea5e9' }}>
                  £{acc.balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Growth assets list */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PiggyBank size={16} color="#10b981" />
            Growth Assets (Savings & Pension)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data?.growth.map(acc => (
              <div key={acc.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{acc.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                    <span>{acc.provider}</span>
                    {acc.interestRate && acc.interestRate > 0 ? (
                      <>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ color: '#10b981', fontWeight: '500' }}>{acc.interestRate}% APR</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#10b981' }}>
                    £{acc.balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </div>
                  {acc.forecastedInterest && acc.forecastedInterest > 0 ? (
                    <div style={{ fontSize: '11px', color: '#10b981', opacity: 0.85, marginTop: '2px' }}>
                      Forecast: +£{acc.forecastedInterest.toFixed(2)}/mo
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

export default AccountsScreen;
