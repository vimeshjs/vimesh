const _ = require('lodash')
const fs = require('fs')
const { mkdirp } = require('mkdirp')
const winston = require('winston')

function setupLogger(config) {

	config = config || { console: {} }

	let transports = []
	_.each(config, (typeConf, type) => {
		switch (type) {
			case 'console':
				transports.push(new winston.transports.Console({
					handleExceptions: true,
					format: winston.format.combine(
						winston.format.colorize(),
						winston.format.simple()
					)
				}))
				break;
			case 'file':
				if (typeConf.dir && !fs.existsSync(typeConf.dir))
					mkdirp.sync(typeConf.dir)
				const DailyRotateFile = require('winston-daily-rotate-file')
				transports.push(
					new DailyRotateFile({
						dirname: typeConf.dir,
						filename: config.name || 'log',
						handleExceptions: true,
						format: winston.format.combine(
							winston.format.timestamp(),
							winston.format.simple()
						)
					})
				)
				break;
			case 'docker':
				transports.push(new winston.transports.Console({
					handleExceptions: true,
					format: winston.format.combine(
						winston.format.label({ label: config.name || 'log' }),
						winston.format.timestamp(),
						winston.format.ms(),
						winston.format.logstash()
					)
				}))
				break;
		}
	})
	let logger = winston.createLogger({
		level: config.level || 'info',
		transports: transports,
		exitOnError: false
	})

	var moduleOrig = require("module");
	var _load_orig = moduleOrig._load;
	var excludes = config.excludes || []
	moduleOrig._load = function (name, parent, isMain) {
		try {
			if (excludes.indexOf(name) == -1)
				moduleOrig._resolveFilename(name, parent);
		} catch (ex) {
			if (name.indexOf('/build/') == -1 &&
				name.indexOf('/vendor/') == -1 &&
				name.indexOf('/node_modules/') == -1)
				logger.error('Fails to load module ' + name, ex)
		}
		return _load_orig(name, parent, isMain);
	};

	process.on('uncaughtException', function (ex) {
		logger.error('Uncaught Exception !!!', ex)
	})

	logger.ignoreMissingModules = names => excludes.push(names)
	global.$logger = logger
}


module.exports = {
	setupLogger
}
