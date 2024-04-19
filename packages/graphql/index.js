const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { glob } = require('glob')
const { loadText } = require('@vimesh/utils')

const { ApolloGateway } = require("@apollo/gateway");
const { ApolloServer, gql } = require("apollo-server")
const { buildFederatedSchema } = require("@apollo/federation")
const { GraphQLDate, GraphQLTime, GraphQLDateTime } = require('graphql-iso-date')
const { GraphQLJSON, GraphQLJSONObject } = require('graphql-type-json')
const { ApolloClient } = require("apollo-boost")
const { createHttpLink } = require('apollo-link-http')
const { InMemoryCache } = require('apollo-cache-inmemory')
const fetch = require('cross-fetch')

function setupGraphQLService(options) {
    if (!fs.existsSync(options.path) || !fs.statSync(options.path).isDirectory())
        throw new Error(`GraphQL server config path "${options.path}" does not exist!`)

    let Server = ApolloServer
    if (options.attach) {
        switch (options.attach.type) {
            case 'Express':
            default:
                Server = require('apollo-server-express').ApolloServer
        }
    }

    let resolvers = {
        Date: GraphQLDate,
        Time: GraphQLTime,
        DateTime: GraphQLDateTime,
        JSON: GraphQLJSON,
        JSONObject: GraphQLJSONObject
    }
    let typeDefs = []

    _.each(glob.sync(options.path + "/**"), function (f) {
        let ext = path.extname(f)
        let name = path.basename(f)
        if (ext) {
            name = name.substring(0, name.length - ext.length)
        }
        if (fs.statSync(f).isFile() &&
            name.substring(0, 1) != '_') {
            if (ext === '.gql') {
                typeDefs.push(gql(loadText(f)))
            } else if (ext === '.js') {
                resolvers = _.merge(resolvers, require(f))
            }
        }
    })
    const server = new Server({
        schema: buildFederatedSchema({ typeDefs, resolvers })
    })
    if (options.attach) {
        switch (options.attach.type) {
            case 'Express':
            default:
                server.applyMiddleware({ app: options.attach.to });
        }
        $logger.info(`GraphQL server ${path.basename(options.path)} runs `)
    } else {
        return server.listen({ port: options.port }).then(({ url }) => {
            $logger.info(`GraphQL server ${path.basename(options.path)} runs at ${url}`)
            return {
                name: options.name || path.basename(options.path),
                url: url
            }
        })
    }
}

function setupGraphQLProxy(options) {
    const gateway = new ApolloGateway({
        serviceList: options.serviceList,
        __exposeQueryPlanExperimental: false //options.exposeQueryPlan,
    });

    const server = new ApolloServer({
        gateway,
        engine: false, //options.engine,
        subscriptions: false,
    })

    return server.listen({ port: options.port }).then(({ url }) => {
        $logger.info(`GraphQL proxy runs at ${url}`)
        return {
            name: options.name || 'proxy',
            url: url
        }
    })
}

function createGraphQLClient(options) {
    const client = new ApolloClient({
        link: createHttpLink({
            uri: options.url,
            fetch: fetch
        }),
        cache: new InMemoryCache()
    })
    return client
}
module.exports = {
    gql,
    setupGraphQLService,
    setupGraphQLProxy,
    createGraphQLClient
}