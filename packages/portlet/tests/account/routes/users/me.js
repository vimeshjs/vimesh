const _ = require('lodash')
function get(req, res) {
    $mock.users.get(req.user.id).then(r => {
        let options = ['option one', 'option two', 'option three']
        res.show(_.extend({ options }, r))
    })
}

module.exports = {
    get: {
        handler: get
    }
}