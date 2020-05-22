const { setupServices } = require('..')
const { loadYaml } = require('@vimesh/utils')
const { setupLogger } = require('@vimesh/logger')
setupLogger()
test('config1', function () {
    let config = loadYaml(`${__dirname}/config1.yaml`)
    return setupServices(config.services).then(() => {
        return Promise.all([
            $services.authService.login('admin', 'admin'),
            $services.authService.login('jacky', 'wrongpass'),
            $services.authService.login('tommy', 'pass2')
        ]).then(rs => {
            expect(rs[0]).toBeTruthy()
            expect(rs[1]).toBeFalsy()
            expect(rs[2]).toBeTruthy()
        })
    })
})
test('config2', function () {
    let config = loadYaml(`${__dirname}/config2.yaml`)
    return setupServices(config.services).then(() => {
        return Promise.all([
            $services.authService.login('admin', 'admin'),
            $services.authService.login('jacky', 'wrongpass'),
            $services.authService.login('tommy', 'pass2')
        ]).then(rs => {
            expect(rs[0]).toBeTruthy()
            expect(rs[1]).toBeFalsy()
            expect(rs[2]).toBeFalsy()
        })
    })
})