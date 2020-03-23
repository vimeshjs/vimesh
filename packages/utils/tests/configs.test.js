const { setupLogger } = require('@vimesh/logger')
const { loadConfigs, pretty } = require('..')
setupLogger()
test('load development configs', () => {
    let context = {
        root : __dirname,
        configsDir : __dirname + '/configs'
    }
    let configs = loadConfigs(context, 'common', 'development')
    //console.log(pretty(configs))
    expect(configs.portlet.layout).toBe('main')
    expect(configs.logger.console.colorized).toBeTruthy()
})
test('load production configs', () => {
    let context = {
        root : __dirname,
        configsDir : __dirname + '/configs'
    }
    let configs = loadConfigs(context, 'common', 'production')
    //console.log(pretty(configs))
    expect(configs.portlet.layout).toBe('admin')
    expect(configs.logger.level).toBe('warn')
})