const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { loadConfigs, pretty } = require('..')
setupLogger()
process.env.PORT = 8888
test('load development configs', () => {
    let context = {
        root: __dirname,
        configsDir: __dirname + '/configs',
        env: _.extend(process.env, { PORT: 8888, SELF_URL: 'http://localhost:{{PORT}}' })
    }
    let configs = loadConfigs(context, 'common', 'development')
    console.log(pretty(configs))
    expect(configs.portlet.port).toBe(8888)
    expect(configs.logger.file.dir).toBe(context.root + '/logs')
    expect(configs.portlet.layout).toBe('main')
    expect(configs.portlet.selfUrl).toBe('http://localhost:8888')
    expect(configs.logger.console.colorized).toBeTruthy()
})
test('load production configs', () => {
    let context = {
        root: '/vol',
        configsDir: __dirname + '/configs',
        env: _.extend(process.env, { PORT: 6666, SELF_URL: 'https://vimesh.org:{{PORT}}' })
    }
    let configs = loadConfigs(context, 'common', 'production')
    console.log(pretty(configs))
    expect(configs.portlet.port).toBe(6666)
    expect(configs.logger.file.dir).toBe(context.root + '/logs')
    expect(configs.portlet.layout).toBe('admin')
    expect(configs.portlet.selfUrl).toBe('https://vimesh.org:6666')
    expect(configs.logger.level).toBe('warn')
})