
const users = [
    {
        id: "1",
        name: "Ada Lovelace",
        birthDate: new Date("1815-12-10"),
        username: "@ada"
    },
    {
        id: "2",
        name: "Alan Turing",
        birthDate: new Date("1912-06-23"),
        username: "@complete"
    }
];
let lastId = 2
module.exports = {
    Query: {
        me() {
            return users[0];
        },
        getUserById(root, params){
            return users.find(user => user.id === params.id)
        }
    },
    Mutation: {
        addUser(root, params) {
            let user = {}
            lastId ++
            user.id = lastId + ''
            user.birthDate = new Date(user.birthDate)
            user.name = params.data.name
            user.username = params.data.username
            users.push(user)
            return {result : user}
        }
    },
    User: {
        __resolveReference(object) {
            return users.find(user => user.id === object.id);
        }
    }
};