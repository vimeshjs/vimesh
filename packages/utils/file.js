const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const glob = require("glob")
const yaml = require('js-yaml')

function getFileChecksum(filename, type, callback) {
    if (callback === undefined) {
        callback = type;
        type = 'md5';
    }

    if (!fs.existsSync(filename)) {
        callback('File does not exist!');
    } else {
        let sum = crypto.createHash(type);
        let s = fs.ReadStream(filename);
        s.on('data', function (d) {
            sum.update(d);
        });

        s.on('end', function () {
            let d = sum.digest('hex');
            callback(null, d);
        });
    }
}

function loadYaml(f) {
    try {
        let yamlContent = fs.readFileSync(f).toString()
        return yaml.load(yamlContent)
    } catch (ex) {
        return null;
    }
}

function loadJson(file) {
    try {
        let data = fs.readFileSync(file)
        return JSON.parse(data.toString())
    } catch (ex) {
        return null;
    }
}

function loadText(file) {
    try {
        let data = fs.readFileSync(file)
        return data.toString()
    } catch (ex) {
        return null;
    }
}

function loadFileAs(data, category, name, file) {
    if (!data[category]) data[category] = {}
    let ext = path.extname(file)
    data[category][name] = ext === '.yaml' || ext === '.yml' ? loadYaml(file) : loadJson(file)
    if (!data[category][name])
        $logger.error(`Fails to load ${category}/${name} from ${file}`)
}

function loadDataTree(root) {
    let data = {}
    _.each(glob.sync(root + "/*"), function (dir) {
        if (fs.statSync(dir).isDirectory()) {
            let category = path.basename(dir)
            _.each(glob.sync(dir + "/*"), function (file) {
                let ext = path.extname(file)
                if (_.includes(['.yaml', '.yml', '.json', '.js'], ext)) {
                    let name = path.basename(file)
                    name = name.substring(0, name.length - ext.length)
                    $logger.debug(`DATA ${category}/${name} <- ${file}`)
                    loadFileAs(data, category, name, file)
                }
            })
        }
    })
    return data
}

function loadConfigs(context, ...files) {
    const Handlebars = require("handlebars");
    const configsDir = context.configsDir || path.join(process.cwd(), 'configs')
    let configs = {}
    _.each(files, f => {
        try {
            let filePath = path.join(configsDir, f) + '.yaml'
            let yamlContent = fs.readFileSync(filePath).toString()
            const template = Handlebars.compile(yamlContent);
            let cf = yaml.load(template(context))
            configs = _.merge(configs, cf)
        } catch (ex) {
            if (global.$logger)
                $logger.error(`Fails to load ${f}`, ex)
            else
                console.log(ex)
        }
    })
    return configs
}

module.exports = {
    getFileChecksum,
    loadYaml,
    loadJson,
    loadText,
    loadDataTree,
    loadConfigs
}