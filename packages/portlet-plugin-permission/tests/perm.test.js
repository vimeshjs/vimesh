const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { evaluatePermissionFormular } = require('../utils')

setupLogger()

it('normal cases', () => {
    let ownedPerms = {
        'user.view': true,
        'user.edit': true
    }
    let result = evaluatePermissionFormular('user.view && user.edit', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user.edit || user.delete', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user.view && user.delete', ownedPerms)
    expect(result).toBeFalsy()
})

it('all allowed', () => {
    let ownedPerms = {
        '*.*': true
    }
    let result = evaluatePermissionFormular('user.edit && user.delete', ownedPerms)
    expect(result).toBeTruthy()
})

it('all actions in a resource is allowed ', () => {
    let ownedPerms = {
        'user.*': true,
        'order.view': true
    }
    let result = evaluatePermissionFormular('user.edit && order.view', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user.edit && order.edit', ownedPerms)
    expect(result).toBeFalsy()
    result = evaluatePermissionFormular('user.edit || user.delete', ownedPerms)
    expect(result).toBeTruthy()
})
