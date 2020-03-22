const _ = require('lodash')
const fs = require('fs')
const crypto = require('crypto')
const glob = require("glob")
const yaml = require('js-yaml')

function getFileChecksum(filename, type, callback){
	if (callback === undefined){
		callback = type;
		type = 'md5';
	}

	if (!fs.existsSync(filename)){
		callback('File does not exist!');
	} else {			
		var sum = crypto.createHash(type);
		var s = fs.ReadStream(filename);
		s.on('data', function(d) {
			sum.update(d);
		});

		s.on('end', function() {
			var d = sum.digest('hex');
			callback(null, d);
		});
	}
}

function loadYaml(f){
	try{
		var yamlContent = fs.readFileSync(f).toString()
		return yaml.load(yamlContent)
	}catch(ex){
		return null;
	}
}

function loadJson(file){
    try{
        let data = fs.readFileSync(file)
        return JSON.parse(data.toString())
    } catch(ex){
		return null;
    }
}

function loadText(file){
    try{
        let data = fs.readFileSync(file)
        return data.toString()
    } catch(ex){
		return null;
    }
}

module.exports = {
    getFileChecksum,
	loadYaml,
	loadJson,
	loadText
}