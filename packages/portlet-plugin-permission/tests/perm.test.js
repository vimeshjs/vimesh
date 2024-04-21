const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { evaluatePermissionFormular, empower } = require('../utils')

setupLogger()

it('normal cases', () => {
    let ownedPerms = empower(['user.view', 'user.edit'])
    expect(ownedPerms).toStrictEqual({ 'user.view': true, 'user.edit': true })
    let result = evaluatePermissionFormular('user.view && user.edit', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user.edit || user.delete', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user.view && user.delete', ownedPerms)
    expect(result).toBeFalsy()
    result = evaluatePermissionFormular('', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular(null)
    expect(result).toBeTruthy()
})

it('normal cases @ scope', () => {
    let ownedPerms = empower(['user@{account}.edit', 'user@{account}.view'], { account: 1 })
    expect(ownedPerms).toStrictEqual({ 'user@1.view': true, 'user@1.edit': true })
    let result = evaluatePermissionFormular('user@1.view && user@1.edit', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user@2.view && user@2.edit', ownedPerms)
    expect(result).toBeFalsy()
    result = evaluatePermissionFormular('user@1.edit || user@2.delete', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user@1.view && user@2.delete', ownedPerms)
    expect(result).toBeFalsy()
})

it('all allowed', () => {
    let ownedPerms = empower('*.*')
    expect(ownedPerms).toStrictEqual({ '*.*': true })
    let result = evaluatePermissionFormular('user.edit && user.delete', ownedPerms)
    expect(result).toBeTruthy()
})

it('evaluate permission @ scope', () => {
    let ownedPerms = empower(['user@{account}.edit', 'user@{account}.delete'])
    expect(ownedPerms).toStrictEqual({ 'user@{account}.edit': true, 'user@{account}.delete': true })
    let result = evaluatePermissionFormular('user@{account}.edit && user@{account}.delete', ownedPerms, { account: 'account3' })
    expect(result).toBeTruthy()

    ownedPerms = empower(['user@{account}.edit', 'user@{account}.delete'], { account: 'account3' })
    expect(ownedPerms).toStrictEqual({ 'user@account3.edit': true, 'user@account3.delete': true })
    result = evaluatePermissionFormular('user@{account}.edit && user@{account}.delete', ownedPerms, { account: 'account3' })
    expect(result).toBeTruthy()
})

it('all actions in a resource is allowed ', () => {
    let ownedPerms = empower(['user.*', 'order.view'])
    expect(ownedPerms).toStrictEqual({ 'user.*': true, 'order.view': true })
    let result = evaluatePermissionFormular('user.edit && order.view', ownedPerms)
    expect(result).toBeTruthy()
    result = evaluatePermissionFormular('user.edit && order.edit', ownedPerms)
    expect(result).toBeFalsy()
    result = evaluatePermissionFormular('user.edit || user.delete', ownedPerms)
    expect(result).toBeTruthy()
})

it('complex permissions', () => {
    let ownedPerms = empower(['users.admin'])
    let result = evaluatePermissionFormular('users.admin || (users.create && users.new) || users.self', ownedPerms)
    expect(result).toBeTruthy()
    ownedPerms = empower(['users.create', 'users.view', 'users.new'])
    // this should also work
    //result = evaluatePermissionFormular('users.admin || users.create && users.new || users.edit && !users.new || users.self', ownedPerms)
    result = evaluatePermissionFormular('users.admin || users.create && users.new || (users.edit && !users.new) || users.self', ownedPerms)
    expect(result).toBeTruthy()
    ownedPerms = empower(['users.edit', 'users.view', 'users.new'])
    result = evaluatePermissionFormular('users.admin || users.create && users.new || (users.edit && !users.new) || users.self', ownedPerms)
    expect(result).toBeFalsy()
})
