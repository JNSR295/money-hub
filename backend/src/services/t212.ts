import axios from 'axios';
import { query } from '../db';
import { decrypt } from '../utils/crypto';

interface Trading212Data {
  value: number;       // total portfolio value
  cash: number;        // cash balance
  profitLoss: number;  // gain/loss
}

async function getApiKey(userId: number): Promise<string | null> {
  const result = await query(
    'SELECT trading212_api_key FROM credentials WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0 || !result.rows[0].trading212_api_key) return null;
  return decrypt(result.rows[0].trading212_api_key);
}

export async function getTrading212Portfolio(userId: number): Promise<Trading212Data> {
  const apiKey = await getApiKey(userId);
  if (!apiKey) {
    return getMockPortfolio(); // Fallback to mock data
  }
  
  // Detect if it is a demo or live key based on pattern
  const isDemo = apiKey.toLowerCase().includes('demo') || apiKey.length < 20;
  const baseUrl = isDemo ? 'https://demo.trading212.com' : 'https://api.trading212.com';
  
  try {
    const response = await axios.get(`${baseUrl}/api/v1/equity/portfolio`, {
      headers: { Authorization: apiKey }
    });
    
    const data = response.data;
    return {
      value: data.value || 0.00,
      cash: data.cash || 0.00,
      profitLoss: data.ppl || data.profitLoss || 0.00
    };
  } catch (error: any) {
    console.error('❌ Trading212 fetch error:', error.response?.data || error.message);
    return getMockPortfolio(); // Fallback
  }
}

// --- MOCK DATA FOR DEMO MODE ---
export function getMockPortfolio(): Trading212Data {
  return {
    value: 28450.40, // Total portfolio value
    cash: 1250.00,
    profitLoss: 4230.15 // +£4,230.15 all-time return
  };
}
