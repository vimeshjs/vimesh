
function get(req, res) {
    res.show({
        title: 'account',
        hello: 'world',
        helpers: {
            myName(name){
                return `My name is ${name}`
            }
        }
    })
}

module.exports = {
    get
}