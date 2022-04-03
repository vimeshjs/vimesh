require('./fixture.js')
beforeAll(function(){
    return $mongodb.connected
})
test('create user', function() {
    return $dao.Users.save({_id:'u001', email:'u001@email.com'}).then(function() {
        return $dao.Users.get('u001')
    }).then(function(r) {
        expect(r.email).toBe('u001@email.com')
    })
})
test('set user email', function() {
    return $dao.Users.set('u001', {email:'u001.modified@email.com', name:'test 001'}).then(function() {
        return $dao.Users.get('u001')
    }).then(r =>{
        expect(r.email).toBe('u001.modified@email.com')
        return $dao.Users.set('u001', {$unset : {email : 1}})
    }).then(r=> {
        return $dao.Users.get('u001')
    }).then(r => {
        expect(r.email).toBeUndefined()
        expect(r.name).toBe('test 001')
    })
})
test('get permissions', function(){
    return Promise.all([
        $dao.Users.set('u001', 
        {
            roles : ['special'], 
            departments : [{id : 2, position : '总监'}, {id : 3, position: '组长'}]
        }),
        $dao.Roles.set('special', {permissions : ['sp-read']}),
        $dao.Roles.set('gl', {permissions : ['project-read', 'project-write']}),
        $dao.Roles.set('dir', {permissions : ['report1', 'revenue-adjust']}),
        $dao.Departments.set(2, {name : '研发部', positions:[{name: '总监', role:'dir'},{name: '副总监', role:'dir'}]}),
        $dao.Departments.set(3, {name : '项目一组', positions:[{name: '组长', role:'gl'}]})
    ]).then(function() {
        return $dao.Users.getPermissions('u001').then(r => {
            //console.log(r)
            expect(r[0]).toBe('sp-read')
        })
    })
})
test('insert user', function() {
    let user = {email:'myemail@company.com'}
    return $dao.Users.add(user).then((r)=>{
        return expect($dao.Users.get(user._id)).resolves.toEqual(user)
    })
})
test('list all users', function() {
    return $dao.Users.select().then((r)=>{
        console.log(JSON.stringify(r))
    })
})