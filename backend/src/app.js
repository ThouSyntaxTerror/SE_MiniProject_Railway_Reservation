const express = require('express');
const { requestId, errorHandler } = require('./middleware/errors');
const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const bookingRoutes = require('./routes/bookings');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestId);

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/api', authRoutes);
  app.use('/api/trips', tripRoutes);
  app.use('/api/bookings', bookingRoutes);

  app.use((req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Not found.', requestId: req.requestId }));
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
