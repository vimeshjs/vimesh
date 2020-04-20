const _ = require('lodash')
const crypto = require('crypto')
const { toObjectID } = require('../..')
function generateEncryptedPassword(password, salt) {
	return password == null ? null :
		crypto.createHash('md5').update(password).update('with').update(salt || 'default').digest("hex");
}

module.exports = {
	findAll: ({ Users }, cond) => {
		return Users.find(cond).toArray()
	},
	fetchUsersByPager: ({ Users, Departments, Companies }, { cond, skip, size, sort }) => {
		let allCompDept = []
		const company_obj = {}
		return new Promise((resolve, reject) => {
			// companies
			Promise.all([
				Companies.find({ type: '@' }).toArray(),
				$dao.Departments.getAll({ company_cond: {}, department_cond: {} })
			]).then(result => {
				const companyIds = _.map(result[0], company => {
					company_obj[company._id + ''] = company;
					return company._id + '';
				})
				allCompDept = result[1];
				if (cond['$or']) {
					cond['$and'] = [
						{ $or: [{ company_id: { $in: companyIds } }, { company_id: { $exists: false } }] },
						{ $or: cond['$or'] }
					]
					delete cond['$or'];
				}
				else {
					cond['$or'] = [{ company_id: { $in: companyIds } }, { company_id: { $exists: false } }];
				}
				return Promise.all([
					Users.find(cond).skip(skip).sort(sort).limit(size).toArray(),
					Users.countDocuments(cond)
				]);
			}).then(result => {
				function convertDepartmentStr(did, departments) {
					var result = [];
					function fetchChainStr(did, departments, result) {
						var temp = _.find(departments, function (department) {
							return department._id == did;
						})
						if (temp) {
							if (temp.pid) {
								result.unshift(temp);
								fetchChainStr(temp.pid, departments, result)
							} else {
								result.unshift(temp);
							}
						}
					}
					fetchChainStr(did, departments, result);
					return result;
				}
				const userList = _.map(result[0], function (item) {
					delete item.password;
					item.departments = _.map(item.departments, pos => {
						var str = '';
						_.each(convertDepartmentStr(pos.id, allCompDept), d => {
							str += (d.short_name || d.name) + ' / ';
						});
						return str + pos.position || '';
					})
					return item;
				})
				resolve({
					data: userList,
					totalCount: result[1]
				});
			}).catch(err => {
				reject(err)
			});
		})
	},
	findUsersByPager: ({ Users }, { cond, skip, size }) => {
		return Users.find(cond).skip(skip).limit(size).toArray()
	},
	count: ({ Users }, cond) => {
		return Users.countDocuments(cond)
	},
	findById: ({ Users }, id) => {
		return Users.findOne({ _id: id })
	},
	findByEmail: ({ Users }, email) => {
		return Users.findOne({ email: email })
	},
	findByNameOrEmail: function ({ Users }, idOrEmail) {
		return Users.findOne({ $or: [{ _id: idOrEmail }, { email: idOrEmail }] }).then(user => {
			if (!user || !user.company_id)
				return user
			else
				return $dao.Companies.get(toObjectID(user.company_id)).then(comp => {
					user.company = comp
					return user
				})
		})
	},
	save: function ({ Users }, user) {
		if (!user.password)
			delete user.password
		else {
			user.password = generateEncryptedPassword(user.password, user._id)
			user.token = new Buffer(crypto.randomBytes(30)).toString('hex');
		}
		return this.set(user._id, user)
	},
	checkPassword: function ({ Users }, user, password) {
		if (!user || !user.password) return false;
		var encPassword = generateEncryptedPassword(password, user._id);
		return user.password === encPassword;
	},
	getPermissions: function ({ Users }, id) {
		let all = []
		return this.get(id).then(user => {
			if (user) {
				_.each(user.departments, function (item) {
					all.push($dao.Departments.get(item.id).then(dep => {
						if (dep) {
							let role = null
							_.each(dep.positions, p => {
								if (p.role && p.name == item.position) {
									role = $dao.Roles.get(p.role)
								}
							})
							return role
						}
					}))
				})
				_.each(user.roles, function (item) {
					all.push($dao.Roles.get(item))
				})
				return Promise.all(all).then(rs => {
					let perms = []
					_.each(rs, item => {
						if (item) perms = _.union(perms, item.permissions)
					})
					return perms
				})
			} else {
				return []
			}
		})
	},
	remove({ Users }, cond) {
		return Users.remove(cond);
	},
	findOneByResetPasswordToken: function ({ Users }, cond) {
		return Users.findOne({ resetPasswordToken: cond.resetPasswordToken, resetPasswordExpires: { $gt: cond.resetPasswordExpires } })
	},
	checkUser: function ({ Users }, cond) {
		const c = {};
		if (cond.uid)
			c['_id'] = { $ne: cond.uid };
		if (cond.type === 'no') {
			c['no'] = cond.value;
			return Users.findOne(c)
		}
		else if (cond.type === 'email') {
			c['email'] = cond.value;
			return Users.findOne(c)
		}
		else if (cond.type === 'name') {
			c['name'] = cond.value;
			return Users.findOne(c)
		}
	},
	departmentAndPositions: function ({ Users }, userids) {
		const tasks = [];
		const usersobj = {}
		_.each(userids, id => {
			usersobj[id] = [];
			tasks.push(
				Users.findOne({ _id: id })
			)
		})
		return Promise.all(tasks).then(users => {
			_.each(users, user => {
				usersobj[user._id] = _.map(user.departments, dep => {
					return dep.id + '/' + dep.position;
				})
			})
			return usersobj;
		});
	},
	/**
   * 用户职位是否被审批流程引用
   * @param {*} param0 
   * @param {*} id 
   */
	protection: function ({ Workflows }, id) {
		return Promise.all([
			Workflows.findOne({ 'steps.by.id': id }),
		]).then(r => {
			if (r[0] || r[1] || r[2]) {
				return 1;
			}
			return 0;
		})
	},

}
