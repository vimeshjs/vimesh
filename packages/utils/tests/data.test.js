const { loadDataTree } = require('..')
const { setupLogger } = require('@vimesh/logger')
setupLogger()

test('load data', () => {
    let data = loadDataTree(__dirname + '/data')
    expect(data.enums.Sex).toEqual(['M', 'F'])
    expect(data.enums.Types).toEqual(['A', 'B', 'C'])
})