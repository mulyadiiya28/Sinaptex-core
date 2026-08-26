const { z } = require('zod');

// Custom global error map so default Zod messages are more Indonesian-friendly
// and consistent. Individual schemas can still override with their own .min()/.max() messages.
z.setErrorMap((issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type && issue.received === 'undefined') {
    return { message: `Field wajib diisi` };
  }
  return { message: ctx.defaultError };
});

module.exports = { z };
