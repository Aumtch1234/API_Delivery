const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  const { id_token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: google_id, name: display_name, email, picture: photo_url } = payload;

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (google_id, display_name, email, photo_url, is_verified, providers)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [google_id, display_name, email, photo_url, true, 'google']
      );
      userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    }

    const user = userResult.rows[0];
    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Invalid Google token' });
  }
};
