import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CreditCard, 
  Percent, 
  HelpCircle, 
  Flame, 
  CheckCircle, 
  Calculator, 
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface DebtRepaymentItem {
  id: string;
  name: string;
  provider: string;
  balance: number;
  apr: number;
  monthlyPayoff: number;
  monthsRemaining: number;
  totalInterestPaid: number;
  isInfinite: boolean;
  schedule: Array<{
    month: number;
    payment: number;
    interest: number;
    principal: number;
    remaining: number;
  }>;
}

const COLORS = ['#ef4444', '#f59e0b', '#ec4899', '#8b5cf6'];

function DebtScreen() {
  const [debts, setDebts] = useState<DebtRepaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payoff Plan form state
  const [providerName, setProviderName] = useState('');
  const [aprRate, setAprRate] = useState('');
  const [monthlyPayoff, setMonthlyPayoff] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  useEffect(() => {
    fetchDebtsData();
  }, []);

  const fetchDebtsData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/debts');
      setDebts(response.data.debts);
    } catch (err) {
      setError('Stale or unavailable connection to bank feeds.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigurePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPlan(true);
    try {
      await axios.post('/api/debts/plan', {
        provider_name: providerName,
        interest_rate_apr: parseFloat(aprRate),
        monthly_payoff_amount: parseFloat(monthlyPayoff)
      });
      setProviderName('');
      setAprRate('');
      setMonthlyPayoff('');
      fetchDebtsData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const totalOutstanding = debts.reduce((sum, d) => sum + d.balance, 0);

  const pieData = debts
    .filter(d => d.balance > 0)
    .map(d => ({ name: d.provider, value: d.balance }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Top row - Debt metric overview */}
      <div className="grid-3">
        <div className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#9ca3af', textTransform: 'uppercase' }}>Total Debt Balance</span>
              <div className="metric-value" style={{ fontSize: '32px', color: '#ef4444', background: 'none', WebkitTextFillColor: 'initial', marginTop: '6px' }}>
                £{totalOutstanding.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)' }}>
              <Flame size={20} color="#ef4444" />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '14px' }}>
            Dynamically loaded from Open Banking API (Zero-retention)
          </div>
        </div>

        {/* Configure amortization card */}
        <div className="glass-panel" style={{ padding: '24px', gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calculator size={16} color="#ef4444" />
            Configure Debt Amortization Plan
          </h3>
          <form onSubmit={handleConfigurePlan} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: 0 }}>
              <label className="form-label">Provider Name (Exact Match)</label>
              <select 
                className="form-input" 
                value={providerName} 
                onChange={(e) => setProviderName(e.target.value)}
                required
              >
                <option value="">Select Account...</option>
                {debts.map(d => (
                  <option key={d.id} value={d.provider}>{d.provider} ({d.name})</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ width: '100px', marginBottom: 0 }}>
              <label className="form-label">APR (%)</label>
              <input 
                type="number" 
                step="0.1" 
                placeholder="22.9" 
                className="form-input"
                value={aprRate}
                onChange={(e) => setAprRate(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ width: '130px', marginBottom: 0 }}>
              <label className="form-label">Monthly Repayment</label>
              <input 
                type="number" 
                placeholder="£150" 
                className="form-input"
                value={monthlyPayoff}
                onChange={(e) => setMonthlyPayoff(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ height: '42px' }} disabled={isSavingPlan}>
              Apply & Save
            </button>
          </form>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
        
        {/* Left column - List of debts and amortization schedules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {debts.length === 0 ? (
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
              No outstanding credit cards or debts detected.
            </div>
          ) : (
            debts.map(debt => {
              // Create full chart path: start at index 0 with current balance
              const chartData = [{ month: 'Current', balance: debt.balance }, ...debt.schedule.map(s => ({ month: `M${s.month}`, balance: s.remaining }))];
              
              return (
                <div key={debt.id} className="glass-panel" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '18px', fontWeight: 'bold' }}>{debt.provider}</h4>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{debt.name}</span>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Outstanding Balance</span>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ef4444' }}>
                        £{debt.balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="grid-3" style={{ marginBottom: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>Interest Rate (APR)</span>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Percent size={14} color="#f59e0b" />
                        {debt.apr}%
                      </div>
                    </div>
                    
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>Monthly Allocation</span>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>
                        £{debt.monthlyPayoff.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>Time until Paid-off</span>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: debt.isInfinite ? '#ef4444' : '#10b981' }}>
                        {debt.balance === 0 ? (
                          'Cleared'
                        ) : debt.isInfinite ? (
                          '⚠️ Infinite (pay more!)'
                        ) : (
                          `${debt.monthsRemaining} months`
                        )}
                      </div>
                    </div>
                  </div>

                  {debt.balance > 0 && (
                    <div className="grid-2" style={{ gap: '20px', alignItems: 'center' }}>
                      {/* Trajectory mini line-chart */}
                      <div style={{ height: '140px' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', display: 'block' }}>
                          Repayment Trajectory (12 Months)
                        </span>
                        {!debt.isInfinite && (
                          <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                              <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '9px' }} />
                              <YAxis stroke="#6b7280" style={{ fontSize: '9px' }} tickFormatter={(val) => `£${val}`} />
                              <Tooltip 
                                formatter={(value) => `£${(value as number).toFixed(2)}`}
                                contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                              />
                              <Line type="monotone" dataKey="balance" stroke="#ef4444" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      
                      {/* Info on interest */}
                      <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', marginTop: '16px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingDown size={14} color="#ef4444" />
                          Payoff Valuation Stats
                        </span>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span>Total Interest Paid:</span>
                            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                              {debt.isInfinite ? 'N/A' : `£${debt.totalInterestPaid.toLocaleString()}`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span>Effective Repayment Cost:</span>
                            <span style={{ fontWeight: 'bold' }}>
                              {debt.isInfinite ? 'N/A' : `£${(debt.balance + debt.totalInterestPaid).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right column - Debt distribution visualization */}
        <div>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingDown size={16} color="#ef4444" />
              Debt Allocation
            </h4>
            
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `£${(value as number).toLocaleString()}`}
                      contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '16px' }}>
                  {pieData.map((entry, index) => (
                    <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: COLORS[index % COLORS.length] }} />
                        <span style={{ color: '#9ca3af' }}>{entry.name}</span>
                      </div>
                      <span style={{ fontWeight: 'bold' }}>
                        {((entry.value / totalOutstanding) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: '#6b7280', fontSize: '13px', padding: '20px 0' }}>No debt to allocate.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

export default DebtScreen;



