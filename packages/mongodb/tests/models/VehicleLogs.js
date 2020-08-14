const _ = require('lodash');
module.exports={
    bulkWrite: ({ VehicleLogs }, arr) => {
        return new Promise(function(resolve, reject){
            let ops = _.map(arr,function(obj){
                // obj._at = new Date();
                // obj._id=$sys.getObjectID();
                return { insertOne: { document: obj}};
            });
            if (ops.length < 1) resolve();
            else VehicleLogs.bulkWrite(ops, {ordered:false},function(err,r){
                if (err) reject(err);
                else resolve(r);
            });
        });
    }
}