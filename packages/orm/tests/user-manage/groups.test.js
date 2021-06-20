const _ = require('lodash')
const { Op } = require("sequelize");
require('./fixture.js')
beforeAll(async function () {
    await $orm.connected
}, 1000 * 60)

test('groups and roles', async function () {
    const { Group, Role } = $orm.dao

    let r1 = await Role.add({ name: 'r1', permissions: ['p1', 'p2'] })
    let r2 = await Role.add({ name: 'r2', permissions: ['p3', 'p2'] })
    let r3 = await Role.add({ name: 'r3', permissions: ['p3', 'p4', 'p5'] })

    let g1 = await Group.add({ name: 'group1', roles: [r1.id, r2.id] })
    let g2 = await Group.add({ name: 'group2', roles: [2, 3] })
    await Group.set({ id: g2.id, roles: [1, 2] })
    let g = await Group.get(2)
    expect(_.map(g.roles, r => r.id)).toEqual([1, 2])

    let g3 = await Group.add({ name: 'group3' })
    await Group.set({ id: g3.id, roles: [1, 3] })
    g = await Group.get(g3.id)
    expect(_.map(g.roles, r => r.id)).toEqual([1, 3])
    let gByName = await Group.get({ name: 'group3' })
    expect(gByName.id).toBe(g.id)
})

test('groups and users', async function () {
    const { Group, User, UserGroup } = $orm.dao
    try {

        let g1 = await Group.get({ name: 'group1' })
        let g2 = await Group.get({ name: 'group2' })


        let u1 = await User.add({ id: 'u001', email: '1@company.com', no: 1, blocked: true })
        let u2 = await User.add({ id: 'u002', email: '2@company.com', no: 2, blocked: true })
        let u3 = await User.add({ id: 'u003', email: '3@company.com', no: 3, blocked: true })
        let u4 = await User.add({ id: 'u004', email: '4@company.com', no: 4 })
        let u5 = await User.add({ id: 'u005', email: '5@company.com', no: 5 })
        let u6 = await User.add({ id: 'u006', email: '6@company.com', no: 6 })

        await UserGroup.add({ userId: 'u001', groupId: g1.id, isLeader: true })
        await UserGroup.add({ userId: 'u006', groupId: g2.id, isLeader: true })
        await User.set({ id: u2.id, groups: [g1.id] })
        await User.set({ id: u3.id, groups: [g1.id, g2.id] })
        await User.set({ id: u4.id, groups: [g2.id] })
        await User.set({ id: u5.id, groups: [g1.id, g2.id] })

        u1 = await User.get('u001')
        expect(u1.groups[0].UserGroup.isLeader).toBe(true)
        u6 = await User.get('u006')
        expect(u6.groups[0].UserGroup.isLeader).toBe(true)
        u5 = await User.get('u005')
        expect(u5.groups[0].UserGroup.isLeader).toBe(false)
        u3 = await User.get('u003')
        expect(u3.groups.length).toBe(2)

        await UserGroup.update({ isLeader: true }, { cond: { userId: 'u003', groupId: g1.id } })
        let ug = await UserGroup.get({ userId: 'u003', groupId: g1.id })
        expect(ug.isLeader).toBe(true)

        await UserGroup.add({ isLeader: false, userId: 'u001', groupId: g2.id })

        let us = await User.select({}, { include: [{ as: 'groups', required: true, through: { as: 'ug', where: { isLeader: true } } }] })
        //console.log(JSON.stringify(us.data, null, 2))
        expect(us.data.length).toBe(3)
        us = await User.select({}, { include: [{ as: 'groups', through: { as: 'ug' } }] })
        //console.log(JSON.stringify(us, null, 2))
        let fus = _.map(us.data, u => {
            let managedGroups = _.filter(u.groups, g => g.ug.isLeader)
            if (managedGroups.length > 0) u.managedGroup = managedGroups[0]
            delete u.groups
            return u
        })
        //console.log(JSON.stringify(fus, null, 2))
        expect(_.filter(fus, u => u.managedGroup).length).toBe(3)

        us = await User.select({}, {
            include: [
                {
                    as: 'ugs',
                    required: false, // LEFT JOIN, if required = true, it will be INNER JOIN
                    where: { isLeader: true },
                    include: ['group']
                }
            ]
        })
        fus = _.map(us.data, u => {
            if (u.ugs.length > 0) {
                u.managedGroup = {
                    isLeader : u.ugs[0].isLeader,
                    groupName: u.ugs[0].group.name
                }
            }
            delete u.ugs
            return u
        })
        //console.log(JSON.stringify(fus, null, 2))   
        expect(fus.length).toBe(6)
        expect(_.filter(fus, u => u.managedGroup).length).toBe(3)
    } catch (ex) {
        console.log(ex)
    }
})