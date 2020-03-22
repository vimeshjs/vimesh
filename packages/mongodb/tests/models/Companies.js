const _ = require('lodash')
const { getObjectID} = require('../..')

module.exports = {
    addSubDep: function ({ Companies }, id, subDepIds) {
        if (!_.isArray(subDepIds)) subDepIds = [subDepIds]
        return Companies.updateOne({ _id: id }, { $addToSet: { sub_deps: { $each: subDepIds } } }).then(r => {
            return !!r.result.ok
        })
    },
    findSubCompaines: ({ Companies }, { cond, skip, size, sort }) => {
        cond.type = '@';
        return Companies.find(cond).skip(skip).sort(sort).limit(size).toArray()
    },
    countSubCompaines: ({ Companies }, cond) => {
        cond.type = '@';
        return Companies.countDocuments(cond);
    },
    findAllSubCompaines: ({ Companies }, cond) => {
        cond.type = '@';
        return Companies.find(cond).toArray()
    },
    findSuppliers: ({ Companies }, { cond, skip, size, sort }) => {
        cond.type = 'supplier';
        return Companies.find(cond).skip(skip).limit(size).sort(sort).toArray()
    },
    countSuppliers: ({ Companies }, cond) => {
        cond.type = 'supplier';
        return Companies.countDocuments(cond);
    },
    findAllSuppliers: ({ Companies }, cond) => {
        cond.type = 'supplier';
        return Companies.find(cond).toArray();
    },
    findCustomers: ({ Companies }, { cond, skip, size }) => {
        cond.type = 'customer';
        return Companies.find(cond).skip(skip).limit(size).toArray()
    },
    countCustomers: ({ Companies }, cond) => {
        cond.type = 'customer';
        return Companies.countDocuments(cond);
    },
    findAllCustomers: ({ Companies }, cond) => {
        cond.type = 'customer';
        return Companies.find(cond).toArray();
    },
    findAll: ({ Companies }, cond) => {
        return Companies.find(cond).toArray();
    },
    getAllSubCompaines: ({ Companies, Banks }, cond) => {
        return new Promise((resolve, reject) => {
            cond['type'] = '@';
            const company_obj = {};
            const owner_cids = [];
            Companies.find(cond).toArray().then(company_list => {
                _.map(company_list, c => {
                    c.banks = [];
                    company_obj[c._id + ''] = c;
                    owner_cids.push(c._id + '');
                })
                return Banks.find({ owner_cid: { $in: owner_cids } }).toArray();
            }).then(banks => {
                _.each(banks, bank => {
                    company_obj[bank.owner_cid].banks.push(bank);
                })
                resolve(company_obj);
            }).catch(e => {
                $logger.error(e);
                reject(e);
            });
        })
    },
    createCompany: ({Companies, Banks, Users}, {body, type})  => {
        const company = body.company ;
        company.type = type;
        const banks = body.banks;
        const users = body.users;
        const company_id = getObjectID();
        const promises = [
            Companies.updateOne({ _id: company_id }, { $set: company }, { upsert: true }),
        ];
        _.each(users, user => {
            user.company_id = company_id + '';
            promises.push(
                $dao.Users.save(user)
            )
        });
        _.each(banks, bank => {
            const bank_id = getObjectID();
            bank.owner_cid = company_id + '';
            promises.push(
                Banks.updateOne({ _id: bank_id }, { $set: bank }, { upsert: true })
            )
        });
        return Promise.all(promises)
    },
    protection: function ({ EcuModels,Users}, id) {
        return Promise.all([
            EcuModels.findOne({sid:id}),
            Users.findOne({company_id:id})
        ]).then(r => {
            if(r[0] || r[1]) {
                return 1;
            }
            return 0; 
        });
    }
}