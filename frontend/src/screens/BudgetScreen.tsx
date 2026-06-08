import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  Save, 
  Coins, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface Allocation {
  savings: number;
  treats: number;
  food: number;
  car: number;
}

interface Bill {
  id: number;
  name: string;
  amount: number;
  duration_type: string;
  duration_months: number | null;
  start_date: string;
}

interface BudgetTimelineItem {
  label: string;
  year: number;
  month: number;
  baselineIncome: number;
  billsTotal: number;
  allocations: {
    bills: number;
    savings: number;
    treats: number;
    food: number;
    car: number;
    remaining: number;
  };
  bills: Array<{
    id: number;
    name: string;
    amount: number;
    durationType: string;
    durationMonths: number | null;
    startDate: string;
  }>;
}

interface BudgetData {
  timeline: BudgetTimelineItem[];
  baselineIncome: number;
  configuredAllocations: Allocation;
  bills: Bill[];
}

const COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#6B7280'];

function BudgetScreen() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Allocations form state
  const [savingsAlloc, setSavingsAlloc] = useState(0);
  const [treatsAlloc, setTreatsAlloc] = useState(0);
  const [foodAlloc, setFoodAlloc] = useState(0);
  const [carAlloc, setCarAlloc] = useState(0);
  const [isSavingAlloc, setIsSavingAlloc] = useState(false);

  // Add Bill form state
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDurationType, setBillDurationType] = useState('forever'); // 'forever' or 'fixed'
  const [billDurationMonths, setBillDurationMonths] = useState('');
  const [billStartDate, setBillStartDate] = useState('');
  const [billDomain, setBillDomain] = useState(''); // Clearbit website logo mapping
  const [isAddingBill, setIsAddingBill] = useState(false);

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/budget');
      setData(response.data);
      
      const allocs = response.data.configuredAllocations;
      setSavingsAlloc(allocs.savings);
      setTreatsAlloc(allocs.treats);
      setFoodAlloc(allocs.food);
      setCarAlloc(allocs.car);
    } catch (err) {
      setError('Failed to fetch budget configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAlloc(true);
    try {
      await axios.post('/api/budget/allocations', {
        savings_allocation: savingsAlloc,
        treats_allocation: treatsAlloc,
        food_allocation: foodAlloc,
        car_allocation: carAlloc
      });
      fetchBudgetData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingAlloc(false);
    }
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingBill(true);
    try {
      // If domain is specified, we store it inside the name as metadata "Name [domain.com]" or just clean string
      // Let's attach the domain to name if provided, or let's clean the name and store the domain inside name as suffix: "Netflix (netflix.com)"
      const domainSuffix = billDomain.trim() ? ` [${billDomain.trim().toLowerCase()}]` : '';
      await axios.post('/api/budget/bills', {
        name: `${billName.trim()}${domainSuffix}`,
        amount: parseFloat(billAmount),
        duration_type: billDurationType,
        duration_months: billDurationType === 'fixed' ? parseInt(billDurationMonths) : null,
        start_date: billStartDate
      });
      setBillName('');
      setBillAmount('');
      setBillDurationType('forever');
      setBillDurationMonths('');
      setBillStartDate('');
      setBillDomain('');
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
    // Fallback: guess domain based on first word
    const firstWord = fullName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    return { name: fullName, domain: `${firstWord}.com` };
  };

  if (isLoading && !data) {
    return <div style={{ color: '#9ca3af' }}>Loading budget matrices...</div>;
  }

  // Calculate current allocations pie chart data for current month (central column index 12)
  const currentMonthData = data?.timeline[12];
  const pieData = currentMonthData ? [
    { name: 'Bills', value: currentMonthData.allocations.bills },
    { name: 'Savings', value: currentMonthData.allocations.savings },
    { name: 'Treats', value: currentMonthData.allocations.treats },
    { name: 'Food', value: currentMonthData.allocations.food },
    { name: 'Car', value: currentMonthData.allocations.car },
    { name: 'Buffer / Leftover', value: Math.max(0, currentMonthData.allocations.remaining) }
  ].filter(p => p.value > 0) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Upper Grid - Setup salary & Bill adding */}
      <div className="grid-3">
        
        {/* Allocations setting card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Coins size={16} color="#6366f1" />
              Allocation Splits
            </h3>
            {data && (
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                Salary: £{data.baselineIncome.toLocaleString()}
              </span>
            )}
          </div>
          <form onSubmit={handleUpdateAllocations} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="grid-2" style={{ gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Savings Target (£)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={savingsAlloc} 
                  onChange={(e) => setSavingsAlloc(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Treats Target (£)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={treatsAlloc} 
                  onChange={(e) => setTreatsAlloc(parseFloat(e.target.value) || 0)} 
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Food Budget (£)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={foodAlloc} 
                  onChange={(e) => setFoodAlloc(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Car / Transport (£)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={carAlloc} 
                  onChange={(e) => setCarAlloc(parseFloat(e.target.value) || 0)} 
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '8px' }} disabled={isSavingAlloc}>
              <Save size={14} />
              {isSavingAlloc ? 'Saving...' : 'Update Targets'}
            </button>
          </form>
        </div>

        {/* Add Bill Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Plus size={16} color="#6366f1" />
              Add Outgoing Bill
            </h3>
          </div>
          <form onSubmit={handleAddBill} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="grid-2" style={{ gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Bill Name</label>
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
                <label className="form-label">Website Domain (for logo)</label>
                <input 
                  type="text" 
                  placeholder="netflix.com" 
                  className="form-input" 
                  value={billDomain} 
                  onChange={(e) => setBillDomain(e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">First Bill Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={billStartDate} 
                  onChange={(e) => setBillStartDate(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '10px', alignItems: 'center' }}>
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
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '6px' }} disabled={isAddingBill}>
              Add Bill
            </button>
          </form>
        </div>

        {/* Current Month Split visualization */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h4 style={{ fontSize: '15px', marginBottom: '16px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={16} color="#6366f1" />
            Active Month Allocation Split
          </h4>
          
          {pieData.length > 0 ? (
            <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
              <div style={{ width: '50%', height: '140px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `£${(value as number).toFixed(2)}`}
                      contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pieData.map((entry, index) => (
                  <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: COLORS[index % COLORS.length] }} />
                      <span style={{ color: '#9ca3af' }}>{entry.name}</span>
                    </div>
                    <span style={{ fontWeight: 'bold' }}>£{entry.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#6b7280', fontSize: '13px', padding: '30px 0' }}>Configure allocations to view chart.</div>
          )}
        </div>
      </div>

      {/* Main horizontal scrolling BUDGET MATRIX */}
      <div className="glass-panel matrix-card">
        <div className="card-header" style={{ borderBottom: 'none', marginBottom: '10px' }}>
          <h3 className="card-title">
            <CalendarDays size={18} color="#6366f1" />
            Rolling 24-Month Budgeting Matrix
          </h3>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            ← Scroll horizontally to navigate 12 months backward & 12 months forward →
          </span>
        </div>

        <div className="matrix-scroll-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-th" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10, width: '180px' }}>Category</th>
                {data?.timeline.map((item, idx) => (
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
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Baseline Income row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10, fontWeight: 600 }}>Baseline Income</td>
                {data?.timeline.map((item, idx) => (
                  <td key={`income-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#10b981', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                    +£{item.baselineIncome.toFixed(0)}
                  </td>
                ))}
              </tr>

              {/* Bills Outgoings row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10, fontWeight: 600 }}>Bills Total</td>
                {data?.timeline.map((item, idx) => (
                  <td key={`bills-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#ef4444', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                    -£{item.billsTotal.toFixed(2)}
                  </td>
                ))}
              </tr>

              {/* Mapped Categories row: Savings */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10 }}>Savings Allocation</td>
                {data?.timeline.map((item, idx) => (
                  <td key={`sav-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#9ca3af', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                    -£{item.allocations.savings.toFixed(0)}
                  </td>
                ))}
              </tr>

              {/* Treats row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10 }}>Treats Allocation</td>
                {data?.timeline.map((item, idx) => (
                  <td key={`treats-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#9ca3af', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                    -£{item.allocations.treats.toFixed(0)}
                  </td>
                ))}
              </tr>

              {/* Food row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10 }}>Food Allocation</td>
                {data?.timeline.map((item, idx) => (
                  <td key={`food-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#9ca3af', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                    -£{item.allocations.food.toFixed(0)}
                  </td>
                ))}
              </tr>

              {/* Car row */}
              <tr>
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10 }}>Car / Transit</td>
                {data?.timeline.map((item, idx) => (
                  <td key={`car-${idx}`} className="matrix-td" style={{ textAlign: 'center', color: '#9ca3af', backgroundColor: idx === 12 ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                    -£{item.allocations.car.toFixed(0)}
                  </td>
                ))}
              </tr>

              {/* Buffer / Rollover row */}
              <tr className="matrix-row-highlight">
                <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10, fontWeight: 'bold' }}>Monthly Rollover</td>
                {data?.timeline.map((item, idx) => (
                  <td 
                    key={`rem-${idx}`} 
                    className="matrix-td" 
                    style={{ 
                      textAlign: 'center', 
                      color: item.allocations.remaining >= 0 ? '#10b981' : '#ef4444',
                      backgroundColor: idx === 12 ? 'rgba(99,102,241,0.1)' : 'transparent'
                    }}
                  >
                    £{item.allocations.remaining.toFixed(2)}
                  </td>
                ))}
              </tr>

              {/* Detailed Bills Expansion Rows */}
              <tr>
                <td colSpan={(data?.timeline.length || 0) + 1} style={{ padding: '16px 12px 6px 12px', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                  Granular Bills Propagation
                </td>
              </tr>

              {data?.bills.map(bill => {
                const billInfo = parseBillInfo(bill.name);
                
                return (
                  <tr key={bill.id}>
                    <td className="matrix-td" style={{ position: 'sticky', left: 0, backgroundColor: '#0c1224', zIndex: 10, display: 'flex', alignItems: 'center', borderBottom: 'none' }}>
                      <img 
                        src={`https://logo.clearbit.com/${billInfo.domain}`}
                        alt=""
                        className="supplier-logo"
                        onError={(e) => {
                          // Fallback to initial if image fails
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span>{billInfo.name}</span>
                      <button 
                        onClick={() => handleDeleteBill(bill.id)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', display: 'flex', opacity: 0.3 }}
                        title="Delete bill"
                      >
                        <Trash2 size={12} color="#ef4444" />
                      </button>
                    </td>
                    
                    {data?.timeline.map((item, idx) => {
                      // Check if bill is active in this specific month
                      const isActive = item.bills.some(b => b.id === bill.id);
                      return (
                        <td 
                          key={`bill-${bill.id}-${idx}`} 
                          className="matrix-td" 
                          style={{ 
                            textAlign: 'center', 
                            color: isActive ? '#f9fafb' : '#374151',
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
