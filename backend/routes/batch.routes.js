const express = require('express');
const multer = require('multer');

const router = express.Router();

const {
    getBatches,
    getBatchById,
    createBatch,
    updateBatch,
    deleteBatch,
    previewBatches,
    importBatches,
    getEligibleBatches
} = require('../controllers/batch.controller');

const upload = multer({
    storage: multer.memoryStorage()
});

/*
 * IMPORTANT:
 * /eligible must come BEFORE /:id
 */

router.get('/eligible', getEligibleBatches);

router.get('/', getBatches);

router.get('/:id', getBatchById);

router.post('/', createBatch);

router.put('/:id', updateBatch);

router.delete('/:id', deleteBatch);

router.post(
    '/preview',
    upload.single('file'),
    previewBatches
);

router.post(
    '/import',
    upload.single('file'),
    importBatches
);

module.exports = router;