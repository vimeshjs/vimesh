const _ = require('lodash')
module.exports = {
	findAll: (models, cond) => {
		console.log(_.keys(models))
		//return models.Users.find(cond).toArray()
	}
}
