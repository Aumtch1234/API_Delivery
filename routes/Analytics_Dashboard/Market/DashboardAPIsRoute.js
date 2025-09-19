const express = require('express');
const router = express.Router();
const DashboardController = require('../../../controllers/Analytics_Dashboard/Market/DashboardController');

// GET /dashboard/sales/daily-summary?date=2025-09-19&market_id=37
router.get('/daily-summary', DashboardController.getDailySummary);

// GET /dashboard/sales/monthly-summary?month=9&year=2025&market_id=37
router.get('/monthly-summary', DashboardController.getMonthlySummary);

// GET /dashboard/sales/yearly-summary?year=2025&market_id=37
router.get('/yearly-summary', DashboardController.getYearlySummary);

module.exports = router;