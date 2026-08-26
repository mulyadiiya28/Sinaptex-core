function success(res, data, message = 'OK', statusCode = 200, meta = undefined) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

function created(res, data, message = 'Created') {
  return success(res, data, message, 201);
}

module.exports = { success, created };
