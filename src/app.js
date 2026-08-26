const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

require('./config/validation'); // side-effect: sets global Zod error map
const { registerNotificationListeners } = require('./modules/notification/notification.listener');

registerNotificationListeners(); // MessageSent -> Notification (lihat src/core/eventBus.js)
const env = require('./config/env');
const throttleConfig = require('./config/throttle.config');
const swaggerConfig = require('./config/swagger.config');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: throttleConfig.global.windowMs,
    max: throttleConfig.global.max,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Swagger docs: minimal for now (spec fills in as @openapi JSDoc comments are
// added to *.routes.js files); see docs/api-contract.md for the full endpoint list meanwhile.
const swaggerSpec = swaggerJsdoc({ definition: swaggerConfig.definition, apis: swaggerConfig.apis });
app.use(swaggerConfig.uiPath, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
