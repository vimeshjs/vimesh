const { setupLogger } = require('..')

setupLogger({
    name: 'test',
    docker: {},
    console: {},
    file: { dir: 'logs' }
})

test('logger', () => {
    $logger.info('Hello World')
    $logger.error('Something is strange', new Error('Wrong!'))
})
