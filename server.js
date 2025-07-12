import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "your-project-id",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "your-private-key-id",
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "your-private-key").replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL || "your-client-email",
  client_id: process.env.FIREBASE_CLIENT_ID || "your-client-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
};

let db = null;

try {
  initializeApp({
    credential: cert(serviceAccount)
  });
  db = getFirestore();
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.log('Firebase Admin SDK initialization failed:', error.message);
  console.log('Using mock data for development');
}


// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// DEBUG: log every incoming request
app.use((req, res, next) => {
    console.log('⏱', new Date().toISOString(), req.method, req.path, 'body:', req.body);
    next();
  });
  
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { 
    title: 'Login - Welcome Back',
    error: null 
  });
});

app.get('/signup', (req, res) => {
  res.render('signup', { 
    title: 'Sign Up - Create Account',
    error: null 
  });
});

app.get('/dashboard', async (req, res) => {
  const email = req.query.email;
  
  if (!email) {
    return res.redirect('/login');
  }

  if (!db) {
    return res.render('dashboard', { 
      title: 'Dashboard - Welcome',
      user: {
        fullName: 'Demo User',
        email: email,
        createdAt: new Date().toISOString()
      },
      email: email,
      error: 'Database connection unavailable. Using demo data.'
    });
  }

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      return res.redirect('/login');
    }

    const userData = snapshot.docs[0].data();
    res.render('dashboard', { 
      title: 'Dashboard - Welcome',
      user: userData,
      email: email,
      error: null
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.render('dashboard', { 
      title: 'Dashboard - Welcome',
      user: {
        fullName: 'Demo User',
        email: email,
        createdAt: new Date().toISOString()
      },
      email: email,
      error: 'Error loading user data. Using demo data.'
    });
  }
});

app.post('/signup', async (req, res) => {
  const { fullName, email, password } = req.body;

  console.log('Signup attempt:', { fullName, email, password: '***' });
  console.log('Database connection status:', db ? 'Connected' : 'Not connected');

  if (!fullName || !email || !password) {
    return res.render('signup', { 
      title: 'Sign Up - Create Account',
      error: 'All fields are required' 
    });
  }

  if (!db) {
    return res.render('signup', { 
      title: 'Sign Up - Create Account',
      error: 'Database connection unavailable. Please try again later.' 
    });
  }

  try {
    // Check if user already exists
    const usersRef = db.collection('users');
    console.log('Checking for existing user...');
    const existingUser = await usersRef.where('email', '==', email).get();
    
    if (!existingUser.empty) {
      console.log('User already exists');
      return res.render('signup', { 
        title: 'Sign Up - Create Account',
        error: 'Email already exists' 
      });
    }

    // Create new user
    const newUser = {
      fullName,
      email,
      password, // In production, hash the password
      createdAt: new Date().toISOString()
    };

    console.log('Creating new user:', newUser);
    await usersRef.add(newUser);
    console.log('User created successfully');
    res.redirect(`/dashboard?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('Error creating user:', error.message);
    console.error('Full error:', error);
    res.render('signup', { 
      title: 'Sign Up - Create Account',
      error: 'Registration failed. Please try again.' 
    });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('Login attempt:', { email, password: '***' });
  console.log('Database connection status:', db ? 'Connected' : 'Not connected');

  if (!email || !password) {
    return res.render('login', { 
      title: 'Login - Welcome Back',
      error: 'Email and password are required' 
    });
  }

  if (!db) {
    return res.render('login', { 
      title: 'Login - Welcome Back',
      error: 'Database connection unavailable. Please try again later.' 
    });
  }

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      return res.render('login', { 
        title: 'Login - Welcome Back',
        error: 'Invalid credentials' 
      });
    }

    const userData = snapshot.docs[0].data();
    
    if (userData.password !== password) {
      return res.render('login', { 
        title: 'Login - Welcome Back',
        error: 'Invalid credentials' 
      });
    }

    res.redirect(`/dashboard?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('Error during login:', error);
    res.render('login', { 
      title: 'Login - Welcome Back',
      error: 'Login failed. Please try again.' 
    });
  }
});

app.get('/logout', (req, res) => {
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});