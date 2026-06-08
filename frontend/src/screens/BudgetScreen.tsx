import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  Save, 
  Coins, 
  AlertCircle,
  HelpCircle,
  PiggyBank,
  Wallet,
  CreditCard
} from 'lucide-react';

interface Bill {
  id: number;
  name: string;
  amount: number;
  duration_type: string;
  duration_months: number | null;
  start_date: string;
  category?: string;
  target_account_id?: string | null;
}

interface BudgetTimelineItem {
  label: string;
  year: number;
  month: number;
  baselineIncome: number;
  billsTotal: number;
  bills: Array<{
    id: number;
    name: string;
    amount: number;
    durationType: string;
    durationMonths: number | null;
    startDate: string;
    category?: string;
    targetAccountId?: string | null;
  }>;
}

interface BudgetData {
  timeline: BudgetTimelineItem[];
  baselineIncome: number;
  bills: Bill[];
}

const COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#6B7280'];

function BudgetScreen() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Outgoing form state
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDurationType, setBillDurationType] = useState('forever'); // 'forever' or 'fixed'
  const [billDurationMonths, setBillDurationMonths] = useState('');
  const [billStartDate, setBillStartDate] = useState('');
  const [outgoingCategory, setOutgoingCategory] = useState('bill'); // 'bill', 'saving', 'other'
  const [targetAccountId, setTargetAccountId] = useState('');
  const [isAddingBill, setIsAddingBill] = useState(false);

  // Pagination for budget matrix
  const [startIdx, setStartIdx] = useState(12); // default to current month (index 12)
  const WINDOW_SIZE = 6;

  // Connected accounts state (for savings routing target)
  const [accounts, setAccounts] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);

  useEffect(() => {
    fetchBudgetData();
    fetchAccounts();
    fetchDebts();
  }, []);

  const fetchBudgetData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/budget');
      setData(response.data);
    } catch (err) {
      setError('Failed to fetch budget configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/accounts');
      const allAccounts = [
        ...response.data.liquid.map((a: any) => ({ ...a, type: 'liquid' })),
        ...response.data.growth.map((a: any) => ({ ...a, type: 'growth' }))
      ];
      setAccounts(allAccounts);
    } catch (err) {
      console.error('Failed to load accounts for outgoings router:', err);
    }
  };

  const fetchDebts = async () => {
    try {
      const response = await axios.get('/api/debts');
      setDebts(response.data.debts || []);
    } catch (err) {
      console.error('Failed to load debts for outgoings router:', err);
    }
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingBill(true);
    try {
      const isSaving = outgoingCategory === 'saving';
      const isDebt = outgoingCategory === 'debt';
      await axios.post('/api/budget/bills', {
        name: billName.trim(),
        amount: parseFloat(billAmount),
        duration_type: billDurationType,
        duration_months: billDurationType === 'fixed' ? parseInt(billDurationMonths) : null,
        start_date: billStartDate,
        category: outgoingCategory,
        target_account_id: (isSaving || isDebt) ? targetAccountId : null
      });
      setBillName('');
      setBillAmount('');
      setOutgoingCategory('bill');
      setTargetAccountId('');
      setBillDurationType('forever');
      setBillDurationMonths('');
      setBillStartDate('');
      fetchBudgetData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingBill(false);
    }
  };

  const handleDeleteBill = async (id: number) => {
    try {
      await axios.delete(`/api/budget/bills/${id}`);
      fetchBudgetData();
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to extract clean name and website domain from name metadata
  const parseBillInfo = (fullName: string) => {
    const regex = /(.*?)\s*\[(.*?)\]/;
    const match = fullName.match(regex);
    if (match) {
      return { name: match[1], domain: match[2] };
    }
    
    // Clean name
    const cleanedName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check if there is a match in our mapping dictionary
    const DOMAIN_LOOKUPS: { [key: string]: string } = {
      netflix: 'netflix.com',
      spotify: 'spotify.com',
      lloyds: 'lloydsbank.com',
      barclays: 'barclays.co.uk',
      hsbc: 'hsbc.co.uk',
      santander: 'santander.co.uk',
      halifax: 'halifax.co.uk',
      monzo: 'monzo.com',
      revolut: 'revolut.com',
      starling: 'starlingbank.com',
      trading212: 'trading212.com',
      t212: 'trading212.com',
      paypal: 'paypal.com',
      amazon: 'amazon.co.uk',
      github: 'github.com',
      apple: 'apple.com',
      google: 'google.com',
      microsoft: 'microsoft.com',
      aviva: 'aviva.co.uk',
      ee: 'ee.co.uk',
      vodafone: 'vodafone.co.uk',
      o2: 'o2.co.uk',
      three: 'three.co.uk',
      giffgaff: 'giffgaff.com',
      sky: 'sky.com',
      virgin: 'virginmedia.com',
      bt: 'bt.com',
      octopus: 'octopus.energy',
      britishgas: 'britishgas.co.uk',
      edf: 'edfenergy.com',
      eon: 'eonnext.com',
      uber: 'uber.com',
      deliveroo: 'deliveroo.co.uk',
      gym: 'thegymgroup.com',
      puregym: 'puregym.com',
      strava: 'strava.com',
      adobe: 'adobe.com',
      figma: 'figma.com',
      slack: 'slack.com',
      zoom: 'zoom.us',
      notion: 'notion.so',
      chase: 'chase.co.uk',
      natwest: 'natwest.com',
      nationwide: 'nationwide.co.uk'
    };

    for (const key in DOMAIN_LOOKUPS) {
      if (cleanedName.includes(key)) {
        return { name: fullName, domain: DOMAIN_LOOKUPS[key] };
      }
    }
    
    // Fallback: guess domain based on first word
    const firstWord = fullName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    return { name: fullName, domain: `${firstWord}.com` };
  };

  if (isLoading && !data) {
    return <div style={{ color: '#9ca3af' }}>Loading budget matrices...</div>;
  }

  // Calculate current outgoings for the summary card (Current Month index 12)
  const currentMonth = data?.timeline[12];
  const currentMonthBills = currentMonth ? currentMonth.bills.filter(b => !b.category || b.category === 'bill').reduce((sum, b) => sum + b.amount, 0) : 0;
  const currentMonthSavings = currentMonth ? currentMonth.bills.filter(b => b.category === 'saving').reduce((sum, b) => sum + b.amount, 0) : 0;
  const currentMonthDebt = currentMonth ? currentMonth.bills.filter(b => b.category === 'debt').reduce((sum, b) => sum + b.amount, 0) : 0;
  const currentMonthOther = currentMonth ? currentMonth.bills.filter(b => b.category === 'other').reduce((sum, b) => sum + b.amount, 0) : 0;
  const currentTotalOutgoings = currentMonthBills + currentMonthSavings + currentMonthDebt + currentMonthOther;
  const currentRollover = currentMonth ? (currentMonth.baselineIncome - currentTotalOutgoings) : 0;
  const budgetAllocatedPct = currentMonth ? Math.min(100, (currentTotalOutgoings / currentMonth.baselineIncome) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Upper Grid - Budget Summary & Add Outgoing */}
      <div className="grid-2">
        
        {/* Current Month Summary Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Coins size={16} color="#6366f1" />
              Current Month Summary
            </h3>
            {data && (
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                Income: £{data.baselineIncome.toLocaleString()}
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>Bills Total</span>
              <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-£{currentMonthBills.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>Savings Allocation</span>
              <span style={{ fontWeight: 'bold', color: '#6366f1' }}>-£{currentMonthSavings.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>Debt Payoff</span>
              <span style={{ fontWeight: 'bold', color: '#ec4899' }}>-£{currentMonthDebt.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>Other Outgoings</span>
              <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>-£{currentMonthOther.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
              <span style={{ fontWeight: '600', fontSize: '15px' }}>Monthly Rollover</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px', color: currentRollover >= 0 ? '#10b981' : '#ef4444' }}>
                £{currentRollover.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                <span>Budget Allocated</span>
                <span>{budgetAllocatedPct.toFixed(1)}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${budgetAllocatedPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Add Outgoing Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Plus size={16} color="#6366f1" />
              Add Outgoing
            </h3>
          </div>
          <form onSubmit={handleAddBill} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="grid-2" style={{ gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Netflix" 
                  className="form-input" 
                  value={billName} 
                  onChange={(e) => setBillName(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Monthly Cost (£)</label>
                <input 
                  type="number" 
                  placeholder="10.99" 
                  className="form-input" 
                  value={billAmount} 
                  onChange={(e) => setBillAmount(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Category</label>
                <select 
                  className="form-input" 
                  value={outgoingCategory} 
                  onChange={(e) => {
                    setOutgoingCategory(e.target.value);
                    if (e.target.value !== 'saving' && e.target.value !== 'debt') {
                      setTargetAccountId('');
                    }
                  }}
                >
                  <option value="bill">Bill</option>
                  <option value="saving">Saving</option>
                  <option value="debt">Debt Payoff</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {outgoingCategory === 'saving' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Target Account</label>
                  <select 
                    className="form-input" 
                    value={targetAccountId} 
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    required
                  >
                    <option value="">Select Account...</option>
                    {accounts.map((acc, idx) => (
                      <option key={idx} value={`${acc.provider} - ${acc.name}`}>
                        {acc.provider} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {outgoingCategory === 'debt' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Target Credit Card</label>
                  <select 
                    className="form-input" 
                    value={targetAccountId} 
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    required
                  >
                    <option value="">Select Card...</option>
                    {debts.map((d, idx) => (
                      <option key={idx} value={`${d.provider} - ${d.name}`}>
                        {d.provider} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid-2" style={{ gap: '10px', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">First Payment Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={billStartDate} 
                  onChange={(e) => setBillStartDate(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Duration</label>
                <select 
                  className="form-input" 
                  value={billDurationType} 
                  onChange={(e) => setBillDurationType(e.target.value)}
                >
                  <option value="forever">Forever (Recurring)</option>
                  <option value="fixed">Fixed Months</option>
                </select>
              </div>
            </div>

            {billDurationType === 'fixed' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">No. of Months</label>
                <input 
                  type="number" 
                  placeholder="12" 
                  className="form-input" 
                  value={billDurationMonths} 
                  onChange={(e) => setBillDurationMonths(e.target.value)} 
                  required 
                />
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '6px' }} disabled={isAddingBill}>
              Add Outgoing
            </button>
          </form>
        </div>
      </div>

      {/* Main horizontal scrolling BUDGET MATRIX */}
      <div className="glass-panel matrix-card">
        <div className="card-header" style={{ borderBottom: 'none', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={18} color="#6366f1" />
            <h3 className="card-title">Rolling 24-Month Budgeting Matrix</h3>
          </div>
          
          {data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setStartIdx(prev => Math.max(0, prev - 1))}
                disabled={startIdx === 0}
              >
                ← Prev
              </button>
              
              <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {data.timeline[startIdx].label} to {data.timeline[startIdx + WINDOW_SIZE - 1].label}
              </span>
              
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setStartIdx(prev => Math.min(data.timeline.length - WINDOW_SIZE, prev + 1))}
                disabled={startIdx >= data.timeline.length - WINDOW_SIZE}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="matrix-scroll-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-th" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, width: '180px' }}>Category</th>
                {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                  const idx = startIdx + localIdx;
                  return (
                    <th 
                      key={item.label} 
                      className="matrix-th" 
                      style={{ 
                        textAlign: 'center', 
                        backgroundColor: idx === 12 ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: idx === 12 ? '#fff' : '#9ca3af',
                        fontWeight: idx === 12 ? 'bold' : 'normal'
                      }}
                    >
                      {item.label} {idx === 12 && '(Current)'}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Baseline Income row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, fontWeight: 600 }}>Baseline Income</td>
                {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                  const idx = startIdx + localIdx;
                  return (
                    <td key={`income-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#10b981', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      +£{item.baselineIncome.toFixed(0)}
                    </td>
                  );
                })}
              </tr>

              {/* Bills Outgoings row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, fontWeight: 600 }}>Bills Total</td>
                {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                  const idx = startIdx + localIdx;
                  const val = item.bills.filter(b => !b.category || b.category === 'bill').reduce((sum, b) => sum + b.amount, 0);
                  return (
                    <td key={`bills-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#ef4444', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      -£{val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>

              {/* Savings row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, fontWeight: 600 }}>Savings Total</td>
                {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                  const idx = startIdx + localIdx;
                  const val = item.bills.filter(b => b.category === 'saving').reduce((sum, b) => sum + b.amount, 0);
                  return (
                    <td key={`savings-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#6366f1', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      -£{val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>

              {/* Debt Payoff row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, fontWeight: 600 }}>Debt Payoff</td>
                {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                  const idx = startIdx + localIdx;
                  const val = item.bills.filter(b => b.category === 'debt').reduce((sum, b) => sum + b.amount, 0);
                  return (
                    <td key={`debt-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#ec4899', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      -£{val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>

              {/* Other Outgoings row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, fontWeight: 600 }}>Other Outgoings</td>
                {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                  const idx = startIdx + localIdx;
                  const val = item.bills.filter(b => b.category === 'other').reduce((sum, b) => sum + b.amount, 0);
                  return (
                    <td key={`other-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#f59e0b', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      -£{val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>

              {/* Monthly Rollover row */}
              <tr className="matrix-row-highlight">
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, fontWeight: 'bold' }}>Monthly Rollover</td>
                {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                  const idx = startIdx + localIdx;
                  const bills = item.bills.filter(b => !b.category || b.category === 'bill').reduce((sum, b) => sum + b.amount, 0);
                  const savings = item.bills.filter(b => b.category === 'saving').reduce((sum, b) => sum + b.amount, 0);
                  const debt = item.bills.filter(b => b.category === 'debt').reduce((sum, b) => sum + b.amount, 0);
                  const other = item.bills.filter(b => b.category === 'other').reduce((sum, b) => sum + b.amount, 0);
                  const rolloverVal = item.baselineIncome - (bills + savings + debt + other);
                  return (
                    <td 
                      key={`rem-${idx}`} 
                      className="matrix-td" 
                      style={{ 
                        textAlign: 'center', 
                        color: rolloverVal >= 0 ? '#10b981' : '#ef4444',
                        backgroundColor: idx === 12 ? 'rgba(99,102,241,0.1)' : 'transparent' 
                      }}
                    >
                      £{rolloverVal.toFixed(2)}
                    </td>
                  );
                })}
              </tr>

              {/* Detailed Bills Expansion Rows */}
              <tr>
                <td colSpan={WINDOW_SIZE + 1} style={{ padding: '16px 12px 6px 12px', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                  Outgoing Detail
                </td>
              </tr>

              {data?.bills.map(bill => {
                const isSaving = bill.category === 'saving';
                const isDebt = bill.category === 'debt';
                const isOther = bill.category === 'other';
                const billInfo = parseBillInfo(bill.name);
                
                return (
                  <tr key={bill.id}>
                    <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-matrix-sticky, #0c1224)', zIndex: 10, borderBottom: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {isSaving ? (
                          <div className="supplier-logo" style={{ background: 'rgba(99, 102, 241, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PiggyBank size={12} color="#6366f1" />
                          </div>
                        ) : isDebt ? (
                          <div className="supplier-logo" style={{ background: 'rgba(236, 72, 153, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={12} color="#ec4899" />
                          </div>
                        ) : isOther ? (
                          <div className="supplier-logo" style={{ background: 'rgba(245, 158, 11, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Coins size={12} color="#f59e0b" />
                          </div>
                        ) : (
                          <img 
                            src={`${axios.defaults.baseURL || ''}/api/logo?domain=${billInfo.domain}`}
                            alt=""
                            className="supplier-logo"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 500 }}>{billInfo.name}</span>
                          {(isSaving || isDebt) && bill.target_account_id && (
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                              {(() => {
                                const parts = bill.target_account_id.split(' - ');
                                return parts.length > 1 ? parts.slice(1).join(' - ') : bill.target_account_id;
                              })()}
                            </span>
                          )}
                          {!isSaving && !isDebt && !isOther && (
                            <span style={{ fontSize: '10px', color: '#6b7280' }}>Bill</span>
                          )}
                          {isDebt && (
                            <span style={{ fontSize: '10px', color: '#ec4899' }}>Debt Payoff</span>
                          )}
                          {isOther && (
                            <span style={{ fontSize: '10px', color: '#f59e0b' }}>Other</span>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDeleteBill(bill.id)} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', display: 'flex', opacity: 0.3 }}
                          title="Delete outgoing"
                        >
                          <Trash2 size={12} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                    
                    {data?.timeline.slice(startIdx, startIdx + WINDOW_SIZE).map((item, localIdx) => {
                      const idx = startIdx + localIdx;
                      const isActive = item.bills.some(b => b.id === bill.id);
                      return (
                        <td 
                          key={`bill-${bill.id}-${idx}`} 
                          className="matrix-td" 
                          style={{ 
                            textAlign: 'center', 
                            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                            backgroundColor: idx === 12 ? 'rgba(99,102,241,0.02)' : 'transparent' 
                          }}
                        >
                          {isActive ? `£${parseFloat(bill.amount as any).toFixed(2)}` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default BudgetScreen;
