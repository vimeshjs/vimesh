require('./fixture.js')
const _ = require('lodash')
const {timeout} = require('@vimesh/utils')
const moment = require('moment')
beforeAll(function () {
    return $mongodb.connected
}, 5000)

it('insert many events', async () => {
    const content = _.repeat('1234567890', 10)
    const COUNT = 100
    let daosByDate = []
    for (let i = 0; i < 5; i++) {
        let dt = moment().subtract(i, 'day').toDate()
        let dao = $dao.Event.getDao('system', dt)
        daosByDate.push(dao)
        await dao.indexed
    }
    
    for (let i = 0; i < COUNT; i++) {
        let data = { val: Math.random() * COUNT, content, _at: new Date() }
        await $dao.Event.add(data)
        for (let j = 0; j < daosByDate.length; j++)
            await daosByDate[j].add(data)
    }
    let count = await $dao.Event.count()
    expect(count).toEqual(COUNT)


}, 1000 * 60)