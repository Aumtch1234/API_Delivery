const express = require('express');
const router = express.Router();
const foodCategoryController = require('../../controllers/Client/FoodCategoryController');
const { searchFoodsAndCategories } = require('../../controllers/Client/FoodSearchController');
const {
  getGpRiderRequired,
  getGpRiderRequiredByMonth,
  getGpToday,
  getGpThisWeek,
  getGpThisMonth,
  getGpThisYear,
    getGpRiderRequiredWeekly,
    getGpRiderRequiredYearly

} = require("../../controllers/Client/gp_riderrequired");

// ✅ ต้องวาง /search ไว้ “ก่อน” /:id/foods
router.get("/search", searchFoodsAndCategories);

// ✅ ดึงหมวดหมู่ทั้งหมด
router.get('/', foodCategoryController.getAllCategories);

// ✅ ดึงอาหารตามหมวดหมู่
router.get('/:id/foods', foodCategoryController.getFoodsByCategory);

// ✅ รายได้ GP แยกตามเดือน (สำหรับกราฟ)
router.get("/gp_riderrequired", getGpRiderRequired);
router.get("/gp_riderrequired/monthly", getGpRiderRequiredByMonth);
router.get("/gp_riderrequired/today", getGpToday);
router.get("/gp_riderrequired/week", getGpThisWeek);
router.get("/gp_riderrequired/month", getGpThisMonth);
router.get("/gp_riderrequired/year", getGpThisYear);
router.get("/gp_riderrequired/weekly", getGpRiderRequiredWeekly);
router.get("/gp_riderrequired/monthly", getGpRiderRequiredByMonth);
router.get("/gp_riderrequired/yearly", getGpRiderRequiredYearly);


module.exports = router;
