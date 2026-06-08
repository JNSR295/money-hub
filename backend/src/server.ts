import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { pool, query, initializeDatabase } from './db';
import { encrypt, decrypt } from './utils/crypto';
import { getTrueLayerAccounts, getTrueLayerCards, getMockAccounts, getMockCards } from './services/truelayer';
import { getTrading212Portfolio } from './services/t212';
import { getPayPalBalance } from './services/paypal';

const app = express();
const PORT = process.env.PORT || 5000;

// Setup CORS with dynamic origin support for local networks and localhost
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3002',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    // Check if it is a local host, local loopback, or private network IP (RFC 1918)
    const isLocal = origin.startsWith('http://localhost:') || 
                    origin.startsWith('http://127.0.0.1:') || 
                    origin.startsWith('http://192.168.') || 
                    origin.startsWith('http://10.') || 
                    origin.startsWith('http://172.');
                    
    if (isLocal || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// Request logging middleware for debugging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Setup Session with Postgres Store
const PostgresStore = connectPgSimple(session);
app.use(session({
  store: new PostgresStore({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'supersecret_session_key_for_wealthhub',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: false, // Set to true in prod if behind HTTPS
    sameSite: 'lax'
  }
}));

// Session types decoration
declare module 'express-session' {
  interface SessionData {
    userId: number;
    email: string;
    twoFactorPending: boolean;
    temp2faSecret: string;
  }
}

// Authentication Middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  if (req.session.twoFactorPending) {
    return res.status(403).json({ error: '2FA verification pending.' });
  }
  next();
};

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// Register
app.post('/api/register', async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'All fields (email, password, first name, last name) are required.' });
  }

  // Password complexity validation: at least 8 chars, 1 uppercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character.' 
    });
  }

  // STRICT email registration validation (silently return a generic error)
  if (email.toLowerCase().trim() !== 'jed@jnsr.uk') {
    return res.status(400).json({ error: 'Registration failed. Please try again.' });
  }

  try {
    const userCheck = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email',
      [email.toLowerCase().trim(), hash, firstName.trim(), lastName.trim()]
    );

    const userId = newUser.rows[0].id;

    // Initialize default settings and allocations for the user
    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [userId]);
    await query('INSERT INTO budget_allocations (user_id) VALUES ($1)', [userId]);

    res.status(201).json({ success: true, message: 'Registration successful. Please log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Login
app.post('/api/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.twoFactorPending = true;
      return res.json({ success: true, twoFactorRequired: true });
    }

    // Standard session login
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.twoFactorPending = false;

    res.json({
      success: true,
      user: {
        email: user.email,
        twoFactorEnabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Verify 2FA Token
app.post('/api/login/2fa', async (req: Request, res: Response) => {
  const { token } = req.body;
  const userId = req.session.userId;

  if (!userId || !req.session.twoFactorPending) {
    return res.status(400).json({ error: 'No 2FA verification session active.' });
  }

  if (!token) {
    return res.status(400).json({ error: '2FA token is required.' });
  }

  try {
    const result = await query('SELECT two_factor_secret FROM users WHERE id = $1', [userId]);
    const secretEncrypted = result.rows[0]?.two_factor_secret;
    
    if (!secretEncrypted) {
      return res.status(400).json({ error: '2FA is not set up.' });
    }

    const secret = decrypt(secretEncrypted);
    const verified = authenticator.verify({ token, secret });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid 2FA token.' });
    }

    req.session.twoFactorPending = false;
    res.json({
      success: true,
      user: {
        email: req.session.email,
        twoFactorEnabled: true
      }
    });
  } catch (error) {
    console.error('2FA login verification error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Logout
app.post('/api/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out.' });
    }
    res.clearCookie('sid'); // Clear session cookie
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// Check Session Status / Profile
app.get('/api/me', async (req: Request, res: Response) => {
  if (!req.session.userId || req.session.twoFactorPending) {
    return res.status(401).json({ loggedIn: false });
  }

  try {
    const result = await query('SELECT email, two_factor_enabled FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ loggedIn: false });
    }

    const user = result.rows[0];
    res.json({
      loggedIn: true,
      user: {
        email: user.email,
        twoFactorEnabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ==========================================
// 2. TWO-FACTOR AUTH (2FA) CONFIG ENDPOINTS
// ==========================================

// Setup 2FA - Generate QR Code
app.post('/api/2fa/setup', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const email = req.session.email!;

  try {
    const secret = authenticator.generateSecret();
    req.session.temp2faSecret = secret;

    const otpauth = authenticator.keyuri(email, 'WealthHub', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    res.json({
      qrCode: qrCodeDataUrl,
      secret // display text fallback
    });
  } catch (error) {
    console.error('2FA setup generation error:', error);
    res.status(500).json({ error: 'Failed to generate 2FA QR code.' });
  }
});

// Verify and Enable 2FA
app.post('/api/2fa/verify', requireAuth, async (req: Request, res: Response) => {
  const { token } = req.body;
  const userId = req.session.userId!;
  const tempSecret = req.session.temp2faSecret;

  if (!tempSecret) {
    return res.status(400).json({ error: 'Generate a 2FA QR code first.' });
  }

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  try {
    const verified = authenticator.verify({ token, secret: tempSecret });
    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification token.' });
    }

    // Encrypt and save secret
    const encryptedSecret = encrypt(tempSecret);
    await query(
      'UPDATE users SET two_factor_secret = $1, two_factor_enabled = true WHERE id = $2',
      [encryptedSecret, userId]
    );

    // Clean session
    delete req.session.temp2faSecret;

    res.json({ success: true, message: '2FA enabled successfully.' });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify and enable 2FA.' });
  }
});

// Disable 2FA
app.post('/api/2fa/disable', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    await query(
      'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = false WHERE id = $1',
      [userId]
    );
    res.json({ success: true, message: '2FA disabled successfully.' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA.' });
  }
});

// ==========================================
// 3. API CREDENTIALS CONFIGURATION
// ==========================================

// Save/Update Credentials
app.post('/api/config/credentials', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { truelayer_client_id, truelayer_client_secret, trading212_api_key, paypal_client_id, paypal_client_secret } = req.body;

  try {
    // Encrypt credentials before saving
    const encClientId = truelayer_client_id ? encrypt(truelayer_client_id) : null;
    const encClientSecret = truelayer_client_secret ? encrypt(truelayer_client_secret) : null;
    const encT212Key = trading212_api_key ? encrypt(trading212_api_key) : null;
    const encPaypalId = paypal_client_id ? encrypt(paypal_client_id) : null;
    const encPaypalSecret = paypal_client_secret ? encrypt(paypal_client_secret) : null;

    // Check if user credentials record exists
    const check = await query('SELECT user_id FROM credentials WHERE user_id = $1', [userId]);
    
    if (check.rows.length === 0) {
      await query(
        `INSERT INTO credentials (
          user_id, truelayer_client_id, truelayer_client_secret, trading212_api_key, paypal_client_id, paypal_client_secret
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, encClientId, encClientSecret, encT212Key, encPaypalId, encPaypalSecret]
      );
    } else {
      await query(
        `UPDATE credentials 
         SET truelayer_client_id = COALESCE($2, truelayer_client_id),
             truelayer_client_secret = COALESCE($3, truelayer_client_secret),
             trading212_api_key = COALESCE($4, trading212_api_key),
             paypal_client_id = COALESCE($5, paypal_client_id),
             paypal_client_secret = COALESCE($6, paypal_client_secret),
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, encClientId, encClientSecret, encT212Key, encPaypalId, encPaypalSecret]
      );
    }

    res.json({ success: true, message: 'Credentials updated and stored securely.' });
  } catch (error) {
    console.error('Credentials config error:', error);
    res.status(500).json({ error: 'Failed to store credentials.' });
  }
});

// Get Configuration Status (flags indicating if configured, without showing keys)
app.get('/api/config/credentials', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const result = await query(
      `SELECT truelayer_client_id, trading212_api_key, paypal_client_id, truelayer_access_token 
       FROM credentials WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        truelayerConfigured: false,
        truelayerConnected: false,
        trading212Configured: false,
        paypalConfigured: false
      });
    }

    const row = result.rows[0];
    res.json({
      truelayerConfigured: !!row.truelayer_client_id,
      truelayerConnected: !!row.truelayer_access_token,
      trading212Configured: !!row.trading212_api_key,
      paypalConfigured: !!row.paypal_client_id
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update User Settings
app.post('/api/config/settings', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { baseline_income, current_age, retirement_age, pension_pot, pension_contribution, pension_growth_rate } = req.body;

  try {
    await query(
      `UPDATE user_settings 
       SET baseline_income = COALESCE($2, baseline_income),
           current_age = COALESCE($3, current_age),
           retirement_age = COALESCE($4, retirement_age),
           pension_pot = COALESCE($5, pension_pot),
           pension_contribution = COALESCE($6, pension_contribution),
           pension_growth_rate = COALESCE($7, pension_growth_rate),
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        userId,
        baseline_income !== undefined ? parseFloat(baseline_income) : undefined,
        current_age !== undefined ? parseInt(current_age) : undefined,
        retirement_age !== undefined ? parseInt(retirement_age) : undefined,
        pension_pot !== undefined ? parseFloat(pension_pot) : undefined,
        pension_contribution !== undefined ? parseFloat(pension_contribution) : undefined,
        pension_growth_rate !== undefined ? parseFloat(pension_growth_rate) : undefined,
      ]
    );

    res.json({ success: true, message: 'Settings updated.' });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Get User Settings
app.get('/api/config/settings', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const result = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found.' });
    }
    
    const settings = result.rows[0];
    res.json({
      baselineIncome: parseFloat(settings.baseline_income || '0.00'),
      currentAge: parseInt(settings.current_age || '30'),
      retirementAge: parseInt(settings.retirement_age || '65'),
      pensionPot: parseFloat(settings.pension_pot || '0.00'),
      pensionContribution: parseFloat(settings.pension_contribution || '0.00'),
      pensionGrowthRate: parseFloat(settings.pension_growth_rate || '5.00')
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error.' });
  }
});

// ==========================================
// 4. TRUELAYER OAUTH REDIRECTS
// ==========================================

// Initiate TrueLayer OAuth Link
app.get('/api/truelayer/connect', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const redirectUri = req.query.redirect_uri as string || 'http://localhost:3000/settings';

  try {
    // Get client id
    const result = await query('SELECT truelayer_client_id FROM credentials WHERE user_id = $1', [userId]);
    if (result.rows.length === 0 || !result.rows[0].truelayer_client_id) {
      return res.status(400).json({ error: 'TrueLayer credentials must be configured first.' });
    }

    const clientId = decrypt(result.rows[0].truelayer_client_id);
    const isSandbox = clientId.toLowerCase().includes('sandbox') || clientId.startsWith('test');
    
    const authBase = isSandbox ? 'https://auth.truelayer-sandbox.com' : 'https://auth.truelayer.com';
    const authUrl = `${authBase}/?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=info%20accounts%20balance%20cards%20transactions%20offline_access` +
      `&providers=uk-ob-all` +
      `&state=${userId}`;

    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to construct TrueLayer auth URL.' });
  }
});

// TrueLayer Callback endpoint (called by frontend after redirect)
app.post('/api/truelayer/callback', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { code, redirectUri } = req.body;

  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'Code and redirectUri are required.' });
  }

  try {
    const { exchangeCode } = require('./services/truelayer');
    await exchangeCode(userId, code, redirectUri);
    res.json({ success: true, message: 'TrueLayer account connected successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to exchange TrueLayer auth code.' });
  }
});

// ==========================================
// 5. SCREEN DATA ENDPOINTS (ZERO-RETENTION)
// ==========================================

// SCREEN 1: Dashboard (Cumulative Wealth)
app.get('/api/dashboard', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    // 1. Fetch user configuration (pension, ages)
    const settingsRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    const settings = settingsRes.rows[0] || {};
    
    const currentAge = parseInt(settings.current_age || '30');
    const retirementAge = parseInt(settings.retirement_age || '65');
    const pensionPot = parseFloat(settings.pension_pot || '0.00');
    const pensionContribution = parseFloat(settings.pension_contribution || '0.00');

    // 2. Fetch live data (Dynamic / In-Memory only)
    const tlAccounts = await getTrueLayerAccounts(userId);
    const tlCards = await getTrueLayerCards(userId);
    const t212 = await getTrading212Portfolio(userId);
    const paypal = await getPayPalBalance(userId);

    // 3. Compute balances
    const tlSavingsTotal = tlAccounts
      .filter(a => a.type === 'savings')
      .reduce((sum, a) => sum + a.balance, 0);
    const savingsTotal = tlSavingsTotal + t212.value + paypal.balance;

    const currentTotal = tlAccounts
      .filter(a => a.type === 'current')
      .reduce((sum, a) => sum + a.balance, 0);

    const debtTotal = tlCards.reduce((sum, c) => sum + c.balance, 0);

    // Net Worth = Savings + Current - Debt + Pension Pot
    const netWorth = savingsTotal + currentTotal - debtTotal + pensionPot;

    // 4. Calculate Pension projections
    // Toggles: 3%, 5%, 7%
    const yearsToRetire = Math.max(0, retirementAge - currentAge);
    const monthsToRetire = yearsToRetire * 12;

    const computePensionFV = (rate: number) => {
      if (monthsToRetire === 0) return pensionPot;
      
      const r = (rate / 100) / 12; // monthly rate
      const n = monthsToRetire;
      
      const fvPrincipal = pensionPot * Math.pow(1 + r, n);
      
      let fvAnnuity = 0;
      if (r > 0) {
        fvAnnuity = pensionContribution * ((Math.pow(1 + r, n) - 1) / r);
      } else {
        fvAnnuity = pensionContribution * n;
      }
      
      return parseFloat((fvPrincipal + fvAnnuity).toFixed(2));
    };

    const pensionProjections = {
      growth3pct: computePensionFV(3.0),
      growth5pct: computePensionFV(5.0),
      growth7pct: computePensionFV(7.0),
      targetAge: retirementAge,
      yearsRemaining: yearsToRetire
    };

    res.json({
      netWorth: parseFloat(netWorth.toFixed(2)),
      breakdown: {
        savings: parseFloat(savingsTotal.toFixed(2)),
        current: parseFloat(currentTotal.toFixed(2)),
        debt: parseFloat(debtTotal.toFixed(2)),
        pension: parseFloat(pensionPot.toFixed(2))
      },
      pensionProjections,
      assets: [
        ...tlAccounts.map(a => ({ name: a.name, provider: a.provider, balance: a.balance, type: a.type })),
        { name: 'Trading 212 Portfolio', provider: 'Trading 212', balance: t212.value, type: 'savings' },
        { name: 'PayPal Wallet', provider: 'PayPal', balance: paypal.balance, type: 'current' }
      ]
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to compile dashboard data.' });
  }
});

// SCREEN 2: Debts & Liabilities
app.get('/api/debts', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const liveCards = await getTrueLayerCards(userId);
    const debtsMetaRes = await query('SELECT * FROM debts_metadata WHERE user_id = $1', [userId]);
    const debtsMeta = debtsMetaRes.rows;

    const debtItems = liveCards.map(card => {
      const meta = debtsMeta.find(m => 
        card.provider.toLowerCase().includes(m.provider_name.toLowerCase()) || 
        card.name.toLowerCase().includes(m.provider_name.toLowerCase())
      ) || {
        interest_rate_apr: 24.9,
        monthly_payoff_amount: 50.00
      };

      const balance = card.balance;
      const apr = parseFloat(meta.interest_rate_apr as string);
      const monthlyPayment = parseFloat(meta.monthly_payoff_amount as string);
      const rMonthly = (apr / 100) / 12;

      let monthsRemaining = 0;
      let totalInterestPaid = 0;
      let isInfinite = false;
      const schedule = [];

      if (balance > 0) {
        if (monthlyPayment <= balance * rMonthly) {
          isInfinite = true;
          monthsRemaining = -1;
        } else {
          let tempBal = balance;
          while (tempBal > 0.01 && monthsRemaining < 360) {
            const interest = tempBal * rMonthly;
            totalInterestPaid += interest;
            
            let principal = monthlyPayment - interest;
            if (tempBal < principal) {
              principal = tempBal;
              tempBal = 0;
            } else {
              tempBal -= principal;
            }
            monthsRemaining++;
            
            schedule.push({
              month: monthsRemaining,
              payment: monthlyPayment,
              interest,
              principal,
              remaining: parseFloat(tempBal.toFixed(2))
            });
          }
          if (monthsRemaining >= 360) {
            monthsRemaining = -2;
          }
        }
      }

      return {
        id: card.id,
        name: card.name,
        provider: card.provider,
        balance,
        apr,
        monthlyPayoff: monthlyPayment,
        monthsRemaining,
        totalInterestPaid: parseFloat(totalInterestPaid.toFixed(2)),
        isInfinite,
        schedule: schedule.slice(0, 12)
      };
    });

    res.json({ debts: debtItems });
  } catch (error) {
    console.error('Debts API error:', error);
    res.status(500).json({ error: 'Failed to fetch debts.' });
  }
});

app.post('/api/debts/plan', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { provider_name, interest_rate_apr, monthly_payoff_amount } = req.body;

  if (!provider_name || interest_rate_apr === undefined || monthly_payoff_amount === undefined) {
    return res.status(400).json({ error: 'provider_name, interest_rate_apr, and monthly_payoff_amount are required.' });
  }

  try {
    const check = await query(
      'SELECT id FROM debts_metadata WHERE user_id = $1 AND LOWER(provider_name) = LOWER($2)',
      [userId, provider_name.trim()]
    );

    if (check.rows.length === 0) {
      await query(
        `INSERT INTO debts_metadata (user_id, provider_name, account_type, interest_rate_apr, monthly_payoff_amount)
         VALUES ($1, $2, 'credit_card', $3, $4)`,
        [userId, provider_name.trim(), parseFloat(interest_rate_apr), parseFloat(monthly_payoff_amount)]
      );
    } else {
      await query(
        `UPDATE debts_metadata 
         SET interest_rate_apr = $3, monthly_payoff_amount = $4 
         WHERE user_id = $1 AND LOWER(provider_name) = LOWER($2)`,
        [userId, provider_name.trim(), parseFloat(interest_rate_apr), parseFloat(monthly_payoff_amount)]
      );
    }

    res.json({ success: true, message: 'Debt repayment plan configured.' });
  } catch (error) {
    res.status(500).json({ error: 'Database error.' });
  }
});

// SCREEN 3: Accounts & Savings
app.get('/api/accounts', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const tlAccounts = await getTrueLayerAccounts(userId);
    const t212 = await getTrading212Portfolio(userId);
    const settingsRes = await query('SELECT pension_pot FROM user_settings WHERE user_id = $1', [userId]);
    const pensionPot = parseFloat(settingsRes.rows[0]?.pension_pot || '0.00');

    const liquidAccounts = tlAccounts
      .filter(a => a.type === 'current')
      .map(a => ({ name: a.name, provider: a.provider, balance: a.balance, accountNumber: a.accountNumber }));

    const growthAccounts = [
      ...tlAccounts.filter(a => a.type === 'savings').map(a => ({ name: a.name, provider: a.provider, balance: a.balance, type: 'savings' })),
      { name: 'Trading 212 Portfolio', provider: 'Trading 212', balance: t212.value, type: 'investments' },
      { name: 'Aviva Pension Pot', provider: 'Aviva (Manual)', balance: pensionPot, type: 'pension' }
    ];

    res.json({
      liquid: liquidAccounts,
      growth: growthAccounts,
      liquidTotal: liquidAccounts.reduce((sum, a) => sum + a.balance, 0),
      growthTotal: growthAccounts.reduce((sum, a) => sum + a.balance, 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts data.' });
  }
});

// SCREEN 4: Rolling 24-Month Budgeting Matrix
app.get('/api/budget', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const settingsRes = await query('SELECT baseline_income FROM user_settings WHERE user_id = $1', [userId]);
    const baselineIncome = parseFloat(settingsRes.rows[0]?.baseline_income || '0.00');

    const allocRes = await query('SELECT * FROM budget_allocations WHERE user_id = $1', [userId]);
    const allocations = allocRes.rows[0] || {};
    
    const savingsAlloc = parseFloat(allocations.savings_allocation || '0.00');
    const treatsAlloc = parseFloat(allocations.treats_allocation || '0.00');
    const foodAlloc = parseFloat(allocations.food_allocation || '0.00');
    const carAlloc = parseFloat(allocations.car_allocation || '0.00');

    const billsRes = await query('SELECT * FROM bills WHERE user_id = $1', [userId]);
    const billsList = billsRes.rows;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIdx = today.getMonth();

    const timeline = [];
    for (let i = -12; i <= 12; i++) {
      const monthDate = new Date(currentYear, currentMonthIdx + i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const monthStr = monthDate.toLocaleString('default', { month: 'short' });
      const yearShort = year.toString().substring(2);

      const activeBills = billsList.filter(bill => {
        const billStart = new Date(bill.start_date);
        const billStartKey = billStart.getFullYear() * 12 + billStart.getMonth();
        const currentKey = year * 12 + month;

        if (currentKey < billStartKey) return false;

        if (bill.duration_type === 'forever') {
          return true;
        } else {
          const duration = parseInt(bill.duration_months);
          return currentKey < (billStartKey + duration);
        }
      });

      const billsSum = activeBills.reduce((sum, b) => sum + parseFloat(b.amount), 0);
      const billsAllocation = billsSum;
      const leftToDistribute = Math.max(0, baselineIncome - billsSum);
      
      const savings = savingsAlloc;
      const treats = treatsAlloc;
      const food = foodAlloc;
      const car = carAlloc;
      const remainingBalance = leftToDistribute - (savings + treats + food + car);

      timeline.push({
        label: `${monthStr} ${yearShort}`,
        year,
        month,
        baselineIncome,
        billsTotal: parseFloat(billsSum.toFixed(2)),
        allocations: {
          bills: parseFloat(billsAllocation.toFixed(2)),
          savings: parseFloat(savings.toFixed(2)),
          treats: parseFloat(treats.toFixed(2)),
          food: parseFloat(food.toFixed(2)),
          car: parseFloat(car.toFixed(2)),
          remaining: parseFloat(remainingBalance.toFixed(2))
        },
        bills: activeBills.map(b => ({
          id: b.id,
          name: b.name,
          amount: parseFloat(b.amount),
          durationType: b.duration_type,
          durationMonths: b.duration_months,
          startDate: b.start_date
        }))
      });
    }

    res.json({
      timeline,
      baselineIncome,
      configuredAllocations: {
        savings: savingsAlloc,
        treats: treatsAlloc,
        food: foodAlloc,
        car: carAlloc
      },
      bills: billsList
    });
  } catch (error) {
    console.error('Budget matrix error:', error);
    res.status(500).json({ error: 'Failed to build budgeting matrix.' });
  }
});

app.post('/api/budget/allocations', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { savings_allocation, treats_allocation, food_allocation, car_allocation } = req.body;

  try {
    await query(
      `UPDATE budget_allocations 
       SET savings_allocation = $2,
           treats_allocation = $3,
           food_allocation = $4,
           car_allocation = $5
       WHERE user_id = $1`,
      [
        userId,
        savings_allocation !== undefined ? parseFloat(savings_allocation) : 0,
        treats_allocation !== undefined ? parseFloat(treats_allocation) : 0,
        food_allocation !== undefined ? parseFloat(food_allocation) : 0,
        car_allocation !== undefined ? parseFloat(car_allocation) : 0
      ]
    );

    res.json({ success: true, message: 'Budget allocations updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update allocations.' });
  }
});

app.post('/api/budget/bills', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { name, amount, duration_type, duration_months, start_date } = req.body;

  if (!name || !amount || !duration_type || !start_date) {
    return res.status(400).json({ error: 'name, amount, duration_type, and start_date are required.' });
  }

  try {
    const parsedAmount = parseFloat(amount);
    const parsedMonths = duration_type === 'fixed' ? parseInt(duration_months) : null;
    const formattedStartDate = new Date(start_date);

    await query(
      `INSERT INTO bills (user_id, name, amount, duration_type, duration_months, start_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, name.trim(), parsedAmount, duration_type, parsedMonths, formattedStartDate]
    );

    res.json({ success: true, message: 'Bill added successfully.' });
  } catch (error) {
    console.error('Add bill error:', error);
    res.status(500).json({ error: 'Failed to add bill.' });
  }
});

app.delete('/api/budget/bills/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const billId = parseInt(req.params.id);

  try {
    const check = await query('DELETE FROM bills WHERE id = $1 AND user_id = $2', [billId, userId]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Bill not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Bill deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bill.' });
  }
});

// Start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Node backend running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database and server:', err);
  process.exit(1);
});
