const _ = require('lodash')
const { toTemplate } = require('@vimesh/utils')
const axios = require('axios')

function createRestfulApi(config) {
    let urlPrefix = config.url
    let optionsTemplate = toTemplate(JSON.stringify(_.omit(config, 'url')))
    function getFullOptions(options) {
        let req = _.merge({ headers: {}, params: {}, body: {}, query: {}, cookies: {} },
            _.pick(options && options.req, 'params', 'query', 'body', 'headers', 'cookies'))
        options = _.merge(JSON.parse(optionsTemplate(req)), _.omit(options, 'req'))
        return options
    }
    return {
        get(url, options) {
            return axios.get(urlPrefix + url, getFullOptions(options))
        },
        delete(url, options) {
            return axios.delete(urlPrefix + url, getFullOptions(options))
        },
        head(url, options) {
            return axios.head(urlPrefix + url, getFullOptions(options))
        },
        options(url, options) {
            return axios.options(urlPrefix + url, getFullOptions(options))
        },
        post(url, data, options) {
            return axios.post(urlPrefix + url, data, getFullOptions(options))
        },
        put(url, data, options) {
            return axios.put(urlPrefix + url, data, getFullOptions(options))
        },
        patch(url, data, options) {
            return axios.patch(urlPrefix + url, data, getFullOptions(options))
        }
    }
}
function setupRemoteApis(portletServer) {
    let config = portletServer.config
    portletServer.remoteApis = {}
    _.each(config.remoteApis, (api, name) => {
        if (api.type === 'grpc') {
            const { createGrpcClient } = require('@vimesh/grpc')
            portletServer.remoteApis[name] = createGrpcClient(api)
        } else if (api.type === 'graphql' || api.type === 'gql') {
            const { createGraphQLClient } = require('@vimesh/graphql')
            portletServer.remoteApis[name] = createGraphQLClient(api)
        } else {
            portletServer.remoteApis[name] = createRestfulApi(api)
        }
    })
}

module.exports = {
    setupRemoteApis
}