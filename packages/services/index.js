const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')

function setupServices(config, options) {
    if (!options) options = {}
    let servicesPath = options.path || path.join(process.cwd(), 'services')
    if (!fs.existsSync(servicesPath)) {
        $logger.error(`Services path ${servicesPath} does not exist!`)
    }
    let services = global.$services = {}
    return Promise.each(_.entries(config), entry => {
        let key = entry[0]
        let val = entry[1]
        let dir = path.join(servicesPath, val.implementation || key)
        if (!fs.existsSync(dir)) {
            $logger.error(`Service ${key} implementation ${dir} does not exist!`)
        } else {
            let imp = require(dir)
            if (!imp.setup) {
                $logger.error(`Service ${key} setup method does not exist!`)
            } else {
                let service = imp.setup(val.settings || {})
                if (service) {
                    if (service.then) {
                        return service.then(r => {
                            services[key] = r
                        })
                    } else {
                        services[key] = service
                    }
                }
            }
        }
    }).then(r => {
        return services
    })
}

module.exports = {
    setupServices
}