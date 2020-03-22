const { setupLogger } = require('..')

setupLogger()

test('logger', () => {
    $logger.info('Hello World')
    $logger.error('Something is strange', new Error('Wrong!'))
})
