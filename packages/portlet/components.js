const vue = require('rollup-plugin-vue')
const buble = require('@rollup/plugin-buble')
const { terser } = require('rollup-plugin-terser')
const resolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const rollup = require('rollup')
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { createMemoryCache } = require('@vimesh/cache')
const { loadYaml } = require('@vimesh/utils')
const includePaths = require('rollup-plugin-includepaths')

function configVue(options) {
    const rollupOptions = {
        input: options.input,
        external: options.external || [],
        plugins: [
            includePaths({
                extensions: ['.js', '.json', '.html', '.vue', '.scss', '.sass', '.less', '.css', '.stylus', '.styl']
            }),
            resolve(),
            commonjs(),
            vue({
                compileTemplate: true,
                css: true,
                needMap: options.debug
            }),
            buble({
                objectAssign: 'Object.assign'
            })
        ]
    }
    if (!options.debug) {
        rollupOptions.plugins.push(terser({
            compress: {
                global_defs: {
                    __DEV__: false
                }
            }
        }))
    }
    rollupOptions.output = {
        file: options.output,
        name: options.name,
        format: 'umd',
        sourcemap: options.debug,
        globals: options.globals || {}
    }

    return _.merge(rollupOptions, options.extraOptions)
}
const COMPONENT_EXT_NAMES = ['.vue']
const ROLLUP_CONFIGS = {
    '.vue': configVue
}

function createComponentCache(portletServer) {
    return createMemoryCache({
        maxAge: portletServer.config.debug ? '3s' : '1h',
        updateAgeOnGet: false,
        onRefresh: function (key) {
            let keyExt = path.extname(key)
            let keyPath = keyExt ? key.substring(0, key.length - keyExt.length) : key
            let file = null
            let config = null
            let meta = null
            _.each(COMPONENT_EXT_NAMES, extName => {
                if (file) return
                let f = path.join(portletServer.componentsDir, keyPath + extName)
                if (fs.existsSync(f)) {
                    file = f
                    config = ROLLUP_CONFIGS[extName]
                }
            })
            if (file && config) {
                let yf = path.join(portletServer.componentsDir, keyPath + '.yaml')
                let options = config({
                    name: keyPath.replace('/', '.'),
                    input: file,
                    output: path.join(process.cwd(), 'mnt/dist', key),
                    debug: portletServer.config.debug,
                    extraOptions: fs.existsSync(yf) ? loadYaml(yf) : {}
                })

                return rollup.rollup(options).then(bundle => {
                    return bundle.write(options.output).then(r => {
                        return options.output.file
                    })
                })
            }
            return file
        }
    })
}

function setupComponents(portletServer) {
    let cache = createComponentCache(portletServer)
    let urlPath = `${portletServer.urlPrefix}/_`
    portletServer.app.get(`${urlPath}/*`, function (req, res, next) {
        let filePath = path.relative(`${urlPath}/`, req.path)
        let map = false
        if (_.endsWith(filePath, '.js.map')) {
            map = true
            filePath = filePath.substring(0, filePath.length - '.map'.length)
        }
        cache.get(filePath).then(generatedFilePath => {
            res.sendFile(map ? generatedFilePath + '.map' : generatedFilePath)
        })
    })
}

module.exports = {
    setupComponents
}