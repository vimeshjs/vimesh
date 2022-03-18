const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const glob = require("glob")

function loadModels(root, baseDb = 'base') {

	global.$schemas = global.$schemas || { models: {}, types: {} }

	_.each(glob.sync(root + "/**"), function (f) {
		let ext = path.extname(f)
		let name = path.basename(f)
		let key = f
		if (ext) {
			key = f.substring(0, f.length - ext.length)
			name = name.substring(0, name.length - ext.length)
		}
		if (fs.statSync(f).isFile() &&
			name.substring(0, 1) != '_') {
			if (ext === '.yaml') {
				let yamlContent = fs.readFileSync(f).toString()
				let json = yaml.load(yamlContent)				
				if (!json || !json.$mapping) {
					$logger.warn(`SCHEMA MODEL ${name} has no mapping!`)
				} else {
					if (!json.$mapping.database)
						json.$mapping.database = baseDb
					if (fs.existsSync(key + '.js')) {
						json.$mapping.methods = require(key + '.js')
					}
					$logger.debug(`SCHEMA MODEL ${name} -> ${json.$mapping.database}/${json.$mapping.collection}`)
				}
				$schemas.models[name] = json
			}
		}
	})

}

module.exports = loadModels