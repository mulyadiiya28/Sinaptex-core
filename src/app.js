const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

require('./config/validation'); // side-effect: sets global Zod error map
const { registerNotificationListeners } = require('./modules/notification/notification.listener');

registerNotificationListeners(); // MessageSent -> Notification (lihat src/core/eventBus.js)
const env = require('./config/env');
const { corsOptions } = require('./config/cors.config');
const swaggerConfig = require('./config/swagger.config');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { rateLimiter } = require('./middlewares/rateLimit.middleware');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);

// Swagger docs: minimal for now (spec fills in as @openapi JSDoc comments are
// added to *.routes.js files); see docs/api-contract.md for the full endpoint list meanwhile.
const swaggerSpec = swaggerJsdoc({ definition: swaggerConfig.definition, apis: swaggerConfig.apis });
app.use(swaggerConfig.uiPath, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.redirect(swaggerConfig.uiPath);
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
