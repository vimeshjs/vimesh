const _ = require('lodash');
module.exports={
    collect: ({ RawUpdate }, type, did, data, sentAt) => {
        return RawUpdate.insert({
            _at : new Date(),
            s_at : sentAt,
            did : did,
            data : data
        }, {w : 0});
    },
    bulkWrite: ({ RawUpdate }, arr) => {
        return new Promise(function(resolve, reject){
            let ops = _.map(arr,function(obj){
                // obj._at = new Date();
                // obj._id=$sys.getObjectID();
                return { insertOne: { document: obj}};
            });
            if (ops.length < 1) resolve();
            else RawUpdate.bulkWrite(ops, {ordered:true, writeConcern : { w : 1, j : false } },function(err,r){
                if (err) reject(err);
                else resolve(r);
            });
        });
    }
}