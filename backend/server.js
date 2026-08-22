import fs from 'fs';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/customer/authRoutes.js';
import customerCityRoutes from './routes/customer/cityRoutes.js';
import customerPlaceRoutes from './routes/customer/placeRoutes.js';
import customerReviewRoutes from './routes/customer/reviewRoutes.js';
import customerFavoriteRoutes from './routes/customer/favoriteRoutes.js';
import customerTripRoutes from './routes/customer/tripRoutes.js';
import customerAIRoutes from './routes/customer/aiRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import adminCityRoutes from './routes/admin/cityRoutes.js';
import adminPlaceRoutes from './routes/admin/placeRoutes.js';
import adminUserRoutes from './routes/admin/userRoutes.js';
import adminReviewRoutes from './routes/admin/reviewRoutes.js';
import adminDashboardRoutes from './routes/admin/dashboardRoutes.js';
import adminImportRoutes from './routes/admin/importRoutes.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';

const port = process.env.PORT || 5000;

connectDB();

const app = express();

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/cities', customerCityRoutes);
app.use('/api/places', customerPlaceRoutes);
app.use('/api/reviews', customerReviewRoutes);
app.use('/api/favorites', customerFavoriteRoutes);
app.use('/api/trips', customerTripRoutes);
app.use('/api/ai', customerAIRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin/cities', adminCityRoutes);
app.use('/api/admin/places', adminPlaceRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/reviews', adminReviewRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/import', adminImportRoutes);

const __dirname = path.resolve();
const isRunningInBackend = __dirname.endsWith('backend') || __dirname.endsWith('backend\\') || __dirname.endsWith('backend/');

const publicPath = isRunningInBackend 
  ? path.join(__dirname, 'public') 
  : path.join(__dirname, 'backend', 'public');

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
app.use(express.static(publicPath));

if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = isRunningInBackend 
    ? path.join(__dirname, '..', 'frontend', 'dist')
    : path.join(__dirname, 'frontend', 'dist');

  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get('*', (req, res) =>
      res.sendFile(path.resolve(frontendDistPath, 'index.html'))
    );
  } else {
    app.get('/', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }
}



app.use(notFound);
app.use(errorHandler);

app.listen(port, () => console.log(`Server started on port ${port}`));
