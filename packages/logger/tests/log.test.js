const { setupLogger } = require('..')

setupLogger({
    name: 'test',
    docker: {}
})

test('logger', () => {
    $logger.info('Hello World')
    $logger.error('Something is strange', new Error('Wrong!'))
})
