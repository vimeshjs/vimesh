const _ = require('lodash')
const { timeout } = require('@vimesh/utils')
const { gql, createGraphQLClient } = require('..')

require('./graphqlServer')

beforeAll(() => {
    return timeout('3s')
}, 1000 * 60)

test('query me', () => {
    let client = createGraphQLClient({ url: 'http://localhost:1000/graphql' })
    return client.query({
        query: gql`{
            me{
                id
                name
                username
                reviews{
                    id
                    body
                    createdAt
                }
            }
        }`
    }).then(r => {
        //console.log(r)
        expect(r.data.me.id).toBe('1')
        expect(r.data.me.name).toBe('Ada Lovelace')
        expect(r.data.me.username).toBe('@ada')
        expect(r.data.me.reviews.length).toBe(2)
        expect(r.data.me.reviews[1].createdAt).toBe("1999-09-09T00:00:00.000Z")
    })
})


test('add user', () => {
    let client = createGraphQLClient({ url: 'http://localhost:1000/graphql' })
    return client.mutate({
        mutation: gql`mutation ($user: addUserInput){
            addUser(data : $user){
              result {
                id,
                name
              }
            }
          }`,
        variables: {
            user: {
                name: 'jacky',
                username: '@jacky'
            }
        }
    }).then(r => {
        let user = r.data.addUser.result
        console.log(user)
        expect(user.id).toBe('3')
        expect(user.name).toBe('jacky')
    })
})