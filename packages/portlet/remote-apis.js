const _ = require('lodash')
const axios = require('axios')

function createRestfulApi(config) {
    let urlPrefix = config.url
    return {
        get(url, options) {
            return axios.get(urlPrefix + url, options)
        },
        delete(url, options) {
            return axios.delete(urlPrefix + url, options)
        },
        head(url, options) {
            return axios.head(urlPrefix + url, options)
        },
        options(url, options) {
            return axios.options(urlPrefix + url, options)
        },
        post(url, data, options) {
            return axios.post(urlPrefix + url, data, options)
        },
        put(url, data, options) {
            return axios.put(urlPrefix + url, data, options)
        },
        patch(url, data, options) {
            return axios.patch(urlPrefix + url, data, options)
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