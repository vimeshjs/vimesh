
module.exports = {
    getByModelAndId : function(model, id){
        return this.get({model : model, 'data._id' : id})
    },
    recover : function(model, id){
        let self = this
        return this.getByModelAndId(model, id).then(r => {
            if (r && r.data && r.data._id){
                return $dao[model].add(r.data).then(ok => {
                    if (ok) self.delete({model : model, 'data._id' : id})
                    return ok
                })
            } else {
                return false
            }
        })
    }
}