const express = require('express');
const router = express.Router();
const foodCategoryController = require('../../controllers/Client/FoodCategoryController');

// ✅ ดึงหมวดหมู่ทั้งหมด
router.get('/', foodCategoryController.getAllCategories);

// ✅ ดึงอาหารตามหมวดหมู่
router.get('/:id/foods', foodCategoryController.getFoodsByCategory);

module.exports = router;
