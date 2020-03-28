let config = {}
let mockUsers = []

function setup(conf) {
    config = conf
    if (config.mock) {
        for (let i = 0; i < 1000; i++) {
            let id = i + 1000
            mockUsers.push({
                id,
                name: 'name ' + id,
                email: id + '@vimesh.org',
                mobile: '888-' + id
            })
        }
    }
}

function get(req, res, next) {
    let cond = req.query.cond || {}
    let pageIndex = req.query.pageIndex || 1
    let pageSize = req.query.pageSize || 10
    let skip = (pageIndex - 1) * pageSize
    let limit = pageSize
    if (config.mock) {
        res.json({
            data: mockUsers.slice(skip, skip + limit),
            count: mockUsers.length
        })
    } else {

    }
}

module.exports = {
    setup,
    get: {
        handler: get,
        inputs: {
            query: {
                cond: 'object',
                pageIndex: 'integer',
                pageSize: 'integer'
            }
        },
        outputs: {
            data: 'User[]',
            count: 'integer'
        }
    }
}