// routes/allRoutes.js
const express = require('express');
const router = express.Router();

const { login, addAdmin, configAdmin } = require('../../controllers/Admin/authController');
const { getAllAdmins, verifyAdmin, getPendingAdmins } = require('../../controllers/Admin/allAdminController');
const { createFood, deleteFood, updateFood } = require('../../controllers/Admin/FoodController');
const { verifyToken } = require('../../middleware/Admin/authMiddleware');
const { getUsersGroupedByProvider } = require('../../controllers/Admin/UsersController');
const marketController = require('../../controllers/Admin/AdminMarketsController');
const marketFoodController = require('../../controllers/Admin/FoodController');




const multer = require('multer');
const { storage } = require('../../utils/Admin/cloudinary');
const upload = multer({ storage });

// Auth
router.post('/login', login);
router.post('/add-admin', addAdmin);
router.post('/config-admin', configAdmin);


// Admin Verification
router.patch('/admins/verify/:id', verifyToken, verifyAdmin);
router.get('/admins/pending', verifyToken, getPendingAdmins);
router.get('/admins/all', verifyToken, getAllAdmins);

// Food Menu
router.post('/addmarket', upload.single('shop_logo_url'), verifyToken, marketFoodController.createMarket);
router.post('/addcategory', verifyToken, marketFoodController.createCategory);
router.get('/getcategories', verifyToken, marketFoodController.getCategories);
router.get('/foods/market/:id', verifyToken, marketFoodController.getFoodsByMarketId);
router.post('/addfood', verifyToken, upload.single('image'), createFood);
router.get('/admin/markets', marketFoodController.getMarkets);
router.delete('/foods/:id', verifyToken, deleteFood);
router.put('/foods/:id', verifyToken, upload.single('image'), updateFood);

//Users Menu
router.get('/users', verifyToken, getUsersGroupedByProvider); // Uncomment if you have a getUsers function


//Markets
router.patch('/market/verify/:id', verifyToken, marketController.verifyMarket);
router.get('/markets/all', verifyToken, marketController.getAllMarkets);

module.exports = router;
