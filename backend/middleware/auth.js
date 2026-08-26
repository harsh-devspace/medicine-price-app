const { supabase } = require('../supabaseClient');

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      // Allow token via query param for direct CSV export downloads
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No authorization token provided.',
      });
    }

    // Verify token using Supabase Auth
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data || !data.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authorization token.',
        error: error ? error.message : undefined,
      });
    }

    // Attach authenticated user to request
    req.user = data.user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal authentication server error.',
    });
  }
};

module.exports = { authMiddleware };
