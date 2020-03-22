require('./fixture.js')
const IDNAME = 'departments_id'

beforeAll(function(){
    return $mongodb.connected
}, 1000 * 60)
it('set current id to 12345', function() {
    return expect($dao.Ids.setId(IDNAME, 12345)).resolves.toBeTruthy()
})
it('get id and increase it', function() {
    return expect($dao.Ids.getNextId(IDNAME)).resolves.toBe(12345)
})
it('get current id', function() {
    return expect($dao.Ids.getId(IDNAME)).resolves.toBe(12346)
})