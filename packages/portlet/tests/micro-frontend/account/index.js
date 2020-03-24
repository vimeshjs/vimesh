'use strict';
const { loadConfigs } = require('@vimesh/utils')
const { setupLogger } = require('@vimesh/logger')
const { setupPortletServer } = require('../../..')
let context = {
    configsDir: __dirname + '/configs',
    root : __dirname,
    env : process.env
}
let configs = loadConfigs(context, 'common', process.env.NODE_ENV)
setupLogger(configs.logger)
setupPortletServer(configs.portlet)
