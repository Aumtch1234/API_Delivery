require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const uploadRoute = require('./routes/upload');
const registerRoute = require('./routes/register');
const loginRoute = require('./routes/login');



app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', uploadRoute);
app.use('/api', registerRoute);
app.use('/api', loginRoute);


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
