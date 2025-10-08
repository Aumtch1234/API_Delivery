const express = require('express');
const router = express.Router();
const foodCategoryController = require('../../controllers/Client/FoodCategoryController');
const { searchFoodsAndCategories } = require('../../controllers/Client/FoodSearchController');


// ✅ ต้องวาง /search ไว้ “ก่อน” /:id/foods
router.get("/search", searchFoodsAndCategories);

// ✅ ดึงหมวดหมู่ทั้งหมด
router.get('/', foodCategoryController.getAllCategories);

// ✅ ดึงอาหารตามหมวดหมู่
router.get('/:id/foods', foodCategoryController.getFoodsByCategory);

module.exports = router;
