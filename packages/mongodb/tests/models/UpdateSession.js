module.exports = {
    bulkWrite: ({ UpdateSession }, ops) => {
        return new Promise(function(resolve, reject){
            if (!ops||ops.length < 1) resolve();
            else UpdateSession.bulkWrite(ops, {ordered:true, writeConcern : { w : 1, j : false } },function(err,r){
                if (err) reject(err);
                else resolve(r);
            });
        });
    }
}