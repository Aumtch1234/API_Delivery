// Middleware สำหรับ debug request body
const debugRequestBody = (req, res, next) => {
    console.log('=== Request Debug ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Body:', req.body);
    console.log('Raw Body Length:', req.get('Content-Length'));
    console.log('===================');
    next();
};

module.exports = { debugRequestBody };