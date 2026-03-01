import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import profileRoutes from './routes/profile.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import './types/index.js';

dotenv.config();

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('HeyyPal Backend is running');
});

app.use('/api/profiles', profileRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

export default app;
