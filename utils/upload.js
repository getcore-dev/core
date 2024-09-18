const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;
    if (file.fieldname === 'resume') {
      uploadPath = './public/uploads/resumes/';
    } else {
      uploadPath = './public/uploads/';
    }
    
    // Create the directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    if (file.fieldname === 'resume') {
      cb(null, 'resume-' + Date.now() + path.extname(file.originalname));
    } else if (file.fieldname === 'file') {
      cb(null, 'profile-' + Date.now() + '.jpg');
    } else {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'resume') {
    const filetypes = /pdf|doc|docx/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    console.log('File MIME type:', file.mimetype);
    console.log('File extension:', path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: Resume upload only supports PDF, DOC, and DOCX formats.'));
  } else {
    cb(null, true);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;