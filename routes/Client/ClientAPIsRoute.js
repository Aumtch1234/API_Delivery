const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../../utils/Client/cloudinary'); // <-- path อาจต้องปรับ
const upload = multer({ storage });

const loginController = require('../../controllers/Client/loginController');
const registerController = require('../../controllers/Client/registerController');
const { googleLogin, updateVerify } = require('../../controllers/Client/authController');
const authenticateJWT = require('../../middleware/Client/auth');
const { getProfile, updateProfile } = require('../../controllers/Client/userController');
const { marketsController, getMyMarket, addFood, getMyFoods, updateFood, updateMarketStatus, updateManualOverride, updateMarketController, deleteFood } = require('../../controllers/Client/marketController');
const { refreshToken } = require('../../controllers/Client/refreshTokenController');
const { sendOtp, verifyOtp } = require('../../controllers/Client/otpController');
const { getAllFoods, getAllMarket, getAllFoodForMarketID, getFoodFromIDForOrder } = require('../../controllers/Client/FoodsController');

const cartsController = require('../../controllers/Client/cartsController');
const profileController = require('../../controllers/Client/userController');
const GoogleMapController = require('../../controllers/Client/GoogleMapController');
const OrdersController = require('../../controllers/Client/ordersController');


//Login and Register Routes
router.post('/google-login', googleLogin);
router.post('/login', loginController.loginUser);
router.post('/register', upload.single('Profile'), registerController.registerUser);
router.post('/update-verify', authenticateJWT, upload.single('Profile'), updateVerify);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

//User Profile Routes
router.put('/update-profile', authenticateJWT, upload.single('Profile'), updateProfile);
router.post('/add/address', authenticateJWT, profileController.addAddress);
router.get('/address', authenticateJWT, profileController.getAddresses);
router.get('/address/default', authenticateJWT, profileController.GetDefaultAddress);
router.put('/update/address/:id', authenticateJWT, profileController.updateAddress);
router.delete('/delete/address/:id', authenticateJWT, profileController.deleteAddress);

//refreshTokenAPI
router.post('/refresh-token', authenticateJWT, refreshToken);

// Protected Routes
router.get('/profile', authenticateJWT, getProfile);

//Market  getMyMarket
router.post('/market/add', authenticateJWT, upload.single('shop_logo'), marketsController);
router.put('/markets/:id', upload.single('shop_logo'), updateMarketController);
router.get('/my-market', authenticateJWT, getMyMarket);
router.patch('/my-market/override/:id', authenticateJWT, updateManualOverride);
router.patch('/my-market/status/:id', authenticateJWT, updateMarketStatus);

//food in owner market
router.post('/food/add', authenticateJWT, upload.single('image'), addFood);
router.get('/my-foods', authenticateJWT, getMyFoods);
router.delete("/food/delete/:food_id", authenticateJWT, deleteFood);
router.put('/food/update/:id', authenticateJWT, upload.single('image'), updateFood);

//Main Market Food 
router.get('/foods', getAllFoods);
router.get('/foods/:marketId', getAllFoodForMarketID);
router.get('/markets', getAllMarket);
router.get('/foods/order/:foodId', getFoodFromIDForOrder);

//carts
router.post('/cart/add', authenticateJWT, cartsController.AddCarts);
router.get('/cart', authenticateJWT, cartsController.GetCarts);
router.put('/address/set-main/:id', authenticateJWT, profileController.setMainAddress);
router.delete('/cart/:cart_id', authenticateJWT, cartsController.RemoveCart);

// Orders
router.get("/orders/user", authenticateJWT, OrdersController.getOrdersByCustomer);
router.get('/orders/:order_id', authenticateJWT, OrdersController.getOrderStatus);
router.post('/orders', authenticateJWT, OrdersController.PostOrders)

// Socket

router.post('/distance', authenticateJWT, GoogleMapController.Distance);

module.exports = router;
