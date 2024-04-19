const vue = require('rollup-plugin-vue')
const buble = require('@rollup/plugin-buble')
const { terser } = require('rollup-plugin-terser')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const { babel } = require('@rollup/plugin-babel')
const commonjs = require('@rollup/plugin-commonjs')
const postcss = require('rollup-plugin-postcss')
const rollup = require('rollup')
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { createMemoryCache } = require('@vimesh/cache')
const { loadYaml } = require('@vimesh/utils')
const includePaths = require('rollup-plugin-includepaths')
const builtins = require('rollup-plugin-node-builtins')
const globals = require('rollup-plugin-node-globals')

function configVue(options) {
    let fullpath = path.join(options.rootDir, 'node_modules', '@babel/preset-env')
    const rollupOptions = {
        input: options.input,
        external: options.external || [],
        plugins: [
            includePaths({
                extensions: ['.js', '.json', '.html', '.vue', '.css']
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: true
            }),
            commonjs(),
            globals(),
            builtins(),
            //scss(),
            postcss({
                plugins: []
            }),
            vue({
                compileTemplate: true,
                css: true,
                needMap: options.debug
            }),
            babel({
                babelHelpers: 'bundled',
                presets: [fullpath],
                exclude: 'node_modules/**'
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
    const extNames = _.get(portletServer.config, 'components.extNames')
    const handlers = _.get(portletServer.config, 'components.handlers') || {}
    const outputDir = _.get(portletServer.config, 'components.outputDir') || portletServer.config.componentsOutputDir || path.join(process.cwd(), 'mnt/dist')
    const cacheTime = _.get(portletServer.config, 'components.cacheTime') || (portletServer.config.debug ? '3s' : '24h')
    return createMemoryCache({
        maxAge: cacheTime,
        updateAgeOnGet: false,
        onRefresh: function (key) {
            let debug = portletServer.config.debug
            let keyExt = path.extname(key)
            let keyPath = keyExt ? key.substring(0, key.length - keyExt.length) : key
            let file = null
            let config = null
            let meta = null
            if (path.extname(keyPath) === '.min') {
                keyPath = keyPath.substring(0, keyPath.length - 4)
                debug = false
            }
            _.each(extNames || COMPONENT_EXT_NAMES, extName => {
                if (file) return
                let f = path.join(portletServer.componentsDir, keyPath + extName)
                if (fs.existsSync(f)) {
                    file = f
                    config = handlers[extName] || ROLLUP_CONFIGS[extName]
                }
            })
            if (file && config) {
                let yf = path.join(portletServer.componentsDir, keyPath + '.yaml')

                let options = config({
                    rootDir: portletServer.rootDir,
                    name: keyPath.split(path.sep).join('.'),
                    input: file,
                    output: path.join(outputDir, key),
                    debug,
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