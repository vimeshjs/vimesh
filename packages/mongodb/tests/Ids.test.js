require('./fixture.js')
const IDNAME = 'departments_id'

beforeAll(async function () {
    await $mongodb.connected
})
it('set current id to 12345', async function () {
    expect(await $dao.Ids.setId(IDNAME, 12345)).toBeTruthy()
})
it('get id and increase it', async function () {
    expect(await $dao.Ids.getNextId(IDNAME)).toBe(12345)
})
it('get current id', async function () {
    expect(await $dao.Ids.getId(IDNAME)).toBe(12346)
})