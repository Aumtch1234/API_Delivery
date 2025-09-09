const cloudinary = require('cloudinary').v2;

// กำหนดค่า Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ฟังก์ชันอัปโหลดรูปภาพ
const uploadToCloudinary = (fileBuffer, folder = 'rider-uploads') => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'image',
                format: 'jpg',
                quality: 'auto:good',
                fetch_format: 'auto',
                transformation: [
                    { width: 1000, height: 1000, crop: 'limit' },
                    { quality: 'auto:good' }
                ]
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        ).end(fileBuffer);
    });
};

// ฟังก์ชันลบรูปภาพ
const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw error;
    }
};

// ฟังก์ชันสำหรับรูปเอกสาร (มีขนาดเฉพาะ)
const uploadDocumentToCloudinary = (fileBuffer, documentType) => {
    const folderMap = {
        'id_card': 'rider-documents/id-cards',
        'driving_license': 'rider-documents/licenses',
        'vehicle': 'rider-documents/vehicles',
        'selfie': 'rider-documents/selfies'
    };

    const folder = folderMap[documentType] || 'rider-documents/others';

    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'image',
                format: 'jpg',
                quality: 'auto:best',
                transformation: [
                    { width: 1500, height: 1500, crop: 'limit' },
                    { quality: 'auto:best' }
                ]
            },
            (error, result) => {
                if (error) {
                    console.error('Document upload error:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        ).end(fileBuffer);
    });
};

module.exports = {
    uploadToCloudinary,
    uploadDocumentToCloudinary,
    deleteFromCloudinary,
    cloudinary
};
