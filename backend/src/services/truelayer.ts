import axios from 'axios';
import { query } from '../db';
import { decrypt, encrypt } from '../utils/crypto';

interface TrueLayerCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
}

// Check if credentials are sandbox or live based on clientId string
function isSandbox(clientId: string): boolean {
  return clientId.toLowerCase().includes('sandbox') || clientId.startsWith('test');
}

function getBaseUrls(clientId: string) {
  if (isSandbox(clientId)) {
    return {
      auth: 'https://auth.truelayer-sandbox.com',
      api: 'https://api.truelayer-sandbox.com'
    };
  }
  return {
    auth: 'https://auth.truelayer.com',
    api: 'https://api.truelayer.com'
  };
}

// Fetch encrypted credentials from database
async function getCredentials(userId: number): Promise<TrueLayerCredentials | null> {
  const result = await query(
    'SELECT truelayer_client_id, truelayer_client_secret, truelayer_access_token, truelayer_refresh_token FROM credentials WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  if (!row.truelayer_client_id || !row.truelayer_client_secret) return null;
  
  return {
    clientId: decrypt(row.truelayer_client_id),
    clientSecret: decrypt(row.truelayer_client_secret),
    accessToken: decrypt(row.truelayer_access_token || ''),
    refreshToken: decrypt(row.truelayer_refresh_token || ''),
  };
}

// Save/update credentials
async function updateTokens(userId: number, accessToken: string, refreshToken: string) {
  await query(
    `INSERT INTO credentials (user_id, truelayer_access_token, truelayer_refresh_token, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE 
     SET truelayer_access_token = EXCLUDED.truelayer_access_token,
         truelayer_refresh_token = EXCLUDED.truelayer_refresh_token,
         updated_at = NOW()`,
    [userId, encrypt(accessToken), encrypt(refreshToken)]
  );
}

// Exchange Auth Code for Access/Refresh Tokens
export async function exchangeCode(userId: number, code: string, redirectUri: string): Promise<void> {
  const creds = await getCredentials(userId);
  if (!creds) throw new Error('TrueLayer Client ID and Secret must be configured first');
  
  const urls = getBaseUrls(creds.clientId);
  
  try {
    const response = await axios.post(`${urls.auth}/connect/token`, {
      grant_type: 'authorization_code',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      code
    });
    
    const { access_token, refresh_token } = response.data;
    await updateTokens(userId, access_token, refresh_token);
  } catch (error: any) {
    console.error('❌ TrueLayer token exchange error:', error.response?.data || error.message);
    throw new Error('Failed to exchange TrueLayer authorization code');
  }
}

// Refresh Access Token
export async function refreshAccessToken(userId: number, creds: TrueLayerCredentials): Promise<string> {
  const urls = getBaseUrls(creds.clientId);
  
  try {
    const response = await axios.post(`${urls.auth}/connect/token`, {
      grant_type: 'refresh_token',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken
    });
    
    const { access_token, refresh_token } = response.data;
    await updateTokens(userId, access_token, refresh_token);
    return access_token;
  } catch (error: any) {
    console.error('❌ TrueLayer token refresh error:', error.response?.data || error.message);
    throw new Error('Failed to refresh TrueLayer access token');
  }
}

// Fetch Accounts
export async function getTrueLayerAccounts(userId: number): Promise<any[]> {
  const creds = await getCredentials(userId);
  if (!creds) {
    return getMockAccounts(); // Fallback to mock data
  }
  
  const urls = getBaseUrls(creds.clientId);
  let token = creds.accessToken;
  
  try {
    // Attempt request
    return await fetchAccounts(urls.api, token);
  } catch (error: any) {
    // If unauthorized, attempt token refresh and retry once
    if (error.response?.status === 401 && creds.refreshToken) {
      console.log('🔄 Access token expired. Refreshing token...');
      try {
        token = await refreshAccessToken(userId, creds);
        return await fetchAccounts(urls.api, token);
      } catch (refreshErr) {
        console.error('❌ Retry failed after token refresh');
        return getMockAccounts(); // Fallback to mock instead of crashing
      }
    }
    console.error('❌ TrueLayer fetch accounts error:', error.response?.data || error.message);
    return getMockAccounts(); // Fallback to mock
  }
}

async function fetchAccounts(baseApiUrl: string, token: string): Promise<any[]> {
  const response = await axios.get(`${baseApiUrl}/data/v1/accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const accounts = response.data.results || [];
  
  // For each account, fetch balance
  const accountsWithBalances = await Promise.all(
    accounts.map(async (acc: any) => {
      try {
        const balResponse = await axios.get(`${baseApiUrl}/data/v1/accounts/${acc.account_id}/balance`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const balance = balResponse.data.results[0] || {};
        return {
          id: acc.account_id,
          name: acc.display_name || acc.description || 'Unknown Account',
          provider: acc.provider?.display_name || 'Bank',
          type: acc.account_type === 'card' ? 'credit_card' : 'current',
          balance: balance.current || 0.00,
          currency: balance.currency || 'GBP',
          accountNumber: acc.account_number?.number || '••••'
        };
      } catch (err) {
        return {
          id: acc.account_id,
          name: acc.display_name || acc.description || 'Unknown Account',
          provider: acc.provider?.display_name || 'Bank',
          type: acc.account_type === 'card' ? 'credit_card' : 'current',
          balance: 0.00,
          currency: 'GBP',
          accountNumber: '••••'
        };
      }
    })
  );
  
  return accountsWithBalances;
}

// Fetch Card Accounts (American Express, Lloyds Credit Card)
export async function getTrueLayerCards(userId: number): Promise<any[]> {
  const creds = await getCredentials(userId);
  if (!creds) {
    return getMockCards(); // Fallback to mock cards
  }
  
  const urls = getBaseUrls(creds.clientId);
  let token = creds.accessToken;

  // Load user full name to detect display name overlaps
  let userFullName = '';
  try {
    const userResult = await query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (user) {
      userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
  } catch (dbErr) {
    console.error('Failed to load user name for cards formatting:', dbErr);
  }
  
  try {
    return await fetchCards(urls.api, token, userFullName);
  } catch (error: any) {
    if (error.response?.status === 401 && creds.refreshToken) {
      console.log('🔄 Access token expired. Refreshing card token...');
      try {
        token = await refreshAccessToken(userId, creds);
        return await fetchCards(urls.api, token, userFullName);
      } catch (refreshErr) {
        return getMockCards();
      }
    }
    return getMockCards();
  }
}

function resolveCardName(card: any, userFullName: string): string {
  const cardName = card.display_name || 'Credit Card';
  const nameOnCard = card.name_on_card ? card.name_on_card.toLowerCase().trim() : '';
  const dispLower = card.display_name ? card.display_name.toLowerCase().trim() : '';
  const userFullNameLower = userFullName ? userFullName.toLowerCase().trim() : '';

  if (
    dispLower && 
    (dispLower === nameOnCard || 
     dispLower === userFullNameLower || 
     (userFullNameLower && dispLower.includes(userFullNameLower)))
  ) {
    const network = card.card_network ? card.card_network.toUpperCase() : 'CARD';
    const type = card.card_type ? card.card_type.replace('_', ' ').toUpperCase() : 'CREDIT';
    return `${network} ${type} (••••${card.partial_card_number || ''})`;
  }
  return cardName;
}

async function fetchCards(baseApiUrl: string, token: string, userFullName: string = ''): Promise<any[]> {
  const response = await axios.get(`${baseApiUrl}/data/v1/cards`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const cards = response.data.results || [];
  
  const cardsWithBalances = await Promise.all(
    cards.map(async (card: any) => {
      const cardName = resolveCardName(card, userFullName);
      try {
        const balResponse = await axios.get(`${baseApiUrl}/data/v1/cards/${card.account_id}/balance`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const balance = balResponse.data.results[0] || {};
        return {
          id: card.account_id,
          name: cardName,
          provider: card.provider?.display_name || 'Card Issuer',
          type: 'credit_card',
          balance: balance.current || 0.00, // outstanding balance
          available: balance.available || 0.00,
          currency: balance.currency || 'GBP',
          accountNumber: card.partial_card_number || '••••'
        };
      } catch (err) {
        return {
          id: card.account_id,
          name: cardName,
          provider: card.provider?.display_name || 'Card Issuer',
          type: 'credit_card',
          balance: 0.00,
          available: 0.00,
          currency: 'GBP',
          accountNumber: '••••'
        };
      }
    })
  );
  
  return cardsWithBalances;
}

export function getMockAccounts(): any[] {
  return [];
}

export function getMockCards(): any[] {
  return [];
}
