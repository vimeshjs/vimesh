const _ = require('lodash')
const sinon = require('sinon')
const { setupLogger } = require('@vimesh/logger')
const { duration } = require('@vimesh/utils')
const clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})

const { execute } = require('..')

setupLogger()

it('should run every 5 seconds ', () => {

    console.log(new Date())
    const callback = jest.fn(() => {
        console.log(1, new Date())
    })
    const config = {
        name: 'test-1',
        job: callback,
        cron: '*/1 * * * * *'
    }
    const job = execute(config)
    clock.tick(duration('1s'))
    clock.tick(duration('1s'))
    clock.tick(duration('4s'))
    clock.tick(duration('7s'))
    job.stop()
    expect(callback).toHaveBeenCalledTimes(13)
})

it('should run every 7 seconds ', () => {
    const callback = jest.fn(() => {
        console.log(2, new Date())
    })
    const config = {
        name: 'test-2',
        job: callback,
        cron: '*/7 * * * * *'
    }
    const job = execute(config)
    clock.tick(duration('1s'))
    clock.tick(duration('1s'))
    clock.tick(duration('4s'))
    clock.tick(duration('7s'))
    job.stop()
    expect(callback).toHaveBeenCalledTimes(2)
})

it('should run every 1 hour', () => {
    const callback = jest.fn((config, memo) => {
        memo.count++
        $logger.info(`3 ${new Date()} ${memo.count}`)
        if (memo.count === 13) throw new Error('13 !')
    })
    const config = {
        name: 'test-3',
        job: callback,
        cron: '59 59 */1 * * *',
        memo: { count: 0 }
    }
    const job = execute(config)
    clock.tick(duration('1h'))
    clock.tick(duration('1h'))
    clock.tick(duration('4h'))
    clock.tick(duration('7h'))
    job.stop()
    console.log(new Date())
    expect(callback).toHaveBeenCalledTimes(13)
})