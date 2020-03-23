
proxy:

services : {
    frontend : {

    }
    account : {
        url : 'localhost:1001'
        token: '---'
    },
    customer: {
        url : 'localhost:1002'
    }
}


service/project

_meta
    module: account
    version: 
    id: 
    runAt : 
_routes
[
    path: '/account/list',

]
_layout?id=main
_partial?id=comp1

context:
    current : account
    module: common/projecta

proxy.getServices()

{{!> common:main}}
{{url account:/login}}
{{> common:login}}

/s/account -> / (account service)

