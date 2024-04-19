
module.exports = {
	setId: function({ Ids }, idName, id) {
        return this.set(idName, {next : id})
    },
    getId: function({ Ids }, idName) {
        return this.get(idName).then((r) => {
            return r && r.next
        })
    },
	getNextId: function({ Ids }, idName, step = 1) {
        return Ids.findOneAndUpdate({_id : idName}, {$inc : {next: step}}, {upsert : true}).then((r) => {
            return r && r.next
        })
    }
}