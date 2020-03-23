'use strict';

const config = require(`./configs/${process.env.NODE_ENV}`)

const { setupLogger } = require('@vimesh/logger')
const { setupViewServer } = require('../../..')

setupLogger(config)
setupViewServer({
    port : process.env.HTTP_PORT || process.env.PORT,
    module: process.env.MODULE || require('./package.json').module || 'unknown',
    layout : process.env.LAYOUT || config.LAYOUT,
    mockDir : config.MOCK ? __dirname + '/mock' : null,
})
