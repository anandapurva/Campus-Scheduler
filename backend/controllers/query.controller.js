const queryService = require('../services/query.service');

const processQuery = async (req, res) => {

    try {

        console.log('QUERY REQUEST RECEIVED:', req.body);

        const { query } = req.body;

        if (!query || query.trim() === '') {

            return res.status(400).json({
                success: false,
                message: 'Please enter a query.'
            });
        }

        const result =
            await queryService.executeQuery(query);

        console.log('QUERY RESULT:', result);

        res.json({
            success: true,
            query: query,
            ...result
        });

    } catch (error) {

        console.error('QUERY ERROR:', error);

        res.status(500).json({
            success: false,
            message: 'Error processing query.',
            error: error.message
        });
    }
};

module.exports = {
    processQuery
};