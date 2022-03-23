const { loadDataTree } = require('..')
const { setupLogger } = require('@vimesh/logger')
setupLogger()

test('load data', () => {
    let data = loadDataTree(__dirname + '/data')
    expect(data._.name).toEqual('Data Center')
    expect(data.enums.category2.cities.shanghai).toEqual('China')
    expect(data.enums.Sex).toEqual(['M', 'F'])
    expect(data.enums.Sex).toEqual(['M', 'F'])
    expect(data.enums.Types).toEqual(['A', 'B', 'C'])
})