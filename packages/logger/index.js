const fs = require('fs')
const mkdirp = require('mkdirp')
const winston = require('winston')

function setupLogger(config) {

	config = config || { LOG_CONSOLE_ONLY: true }

	if (config.LOG_DIR && !fs.existsSync(config.LOG_DIR))
		mkdirp.sync(config.LOG_DIR);

	let transports = []
	if (!config.LOG_CONSOLE_ONLY) {
		const DailyRotateFile = require('winston-daily-rotate-file')
		transports = [
			new DailyRotateFile(
				{
					dirname: config.LOG_DIR,
					filename: config.LOG_NAME || 'daily',
					handleExceptions: true,
					format: winston.format.combine(
						winston.format.timestamp(),
						winston.format.simple()
					)
				})
		]
	}
	if (config.LOG_CONSOLE_ONLY || config.LOG_CONSOLE || process.env.NODE_ENV == 'development') {
		let transportConfig = {
			colorize: config.LOG_CONSOLE_COLORIZED === undefined ? true : config.LOG_CONSOLE_COLORIZED,
			handleExceptions: true,
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple()
			)
		}
		if (process.env.DEPLOY == 'docker') {
			transportConfig.format = winston.format.combine(
				winston.format.label({ label: config.LOG_NAME || 'log' }),
				winston.format.timestamp(),
				winston.format.ms(),
				winston.format.logstash()
			)
		}
		transports.push(new winston.transports.Console(transportConfig));
	}

	if (config.LOG_MONGODB_URI) {
		require('winston-mongodb')
		let options = {
			db: config.LOG_MONGODB_URI,
			collection: 'logs',
			storeHost: true,
			label: config.LOG_NAME,
			decolorize: true,
			tryReconnect: true,
			expireAfterSeconds: (config.LOG_MONGODB_DAYS || 7) * 24 * 60 * 60
		}
		transports.push(new winston.transports.MongoDB(options))
	}
	let logger = winston.createLogger({
		level: config.LOG_LEVEL || 'info',
		transports: transports,
		exitOnError: false
	})

	var moduleOrig = require("module");
	var _load_orig = moduleOrig._load;
	var excludes = ['bson-ext', 'memcpy', 'internal/util', 'worker_threads']
	moduleOrig._load = function (name, parent, isMain) {
		try {
			if (excludes.indexOf(name) == -1)
				moduleOrig._resolveFilename(name, parent);
		} catch (ex) {
			if (name.indexOf('/build/') == -1)
				logger.error('Fails to load module ' + name, ex)
		}
		return _load_orig(name, parent, isMain);
	};

	process.on('uncaughtException', function (ex) {
		logger.error('Uncaught Exception !!!', ex)
	})

	global.$logger = logger
}


module.exports = {
	setupLogger
}
