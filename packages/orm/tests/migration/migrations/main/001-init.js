
const Sequelize = require("sequelize")
module.exports = {
    info : {"revision":1,"name":"init","file":"001-init","created":"2021-06-18T05:02:52.219Z"},
    async up(query, log)
    {
        
        log && log(`Processing createTable("roles",... )`)
        await query.createTable("roles",
     { 
      "id": { "type": Sequelize.INTEGER, "field":"id", "autoIncrement":true, "primaryKey":true, "allowNull":false }, 
      "name": { "type": Sequelize.STRING, "field":"name", "allowNull":false }, 
      "permissions": { "type": Sequelize.JSON, "field":"permissions" }
     },
    {})

        log && log(`Processing createTable("users",... )`)
        await query.createTable("users",
     { 
      "id": { "type": Sequelize.INTEGER, "field":"id", "autoIncrement":true, "primaryKey":true, "allowNull":false }, 
      "login": { "type": Sequelize.STRING, "field":"login", "allowNull":false }, 
      "name": { "type": Sequelize.STRING, "field":"name" }, 
      "password": { "type": Sequelize.STRING, "field":"password" }, 
      "isAdmin": { "type": Sequelize.BOOLEAN, "field":"is_admin", "defaultValue":false, "allowNull":false }, 
      "blocked": { "type": Sequelize.BOOLEAN, "field":"blocked", "defaultValue":false, "allowNull":false }, 
      "avatar": { "type": Sequelize.STRING, "field":"avatar" }
     },
    {})

        log && log(`Processing createTable("user_actions",... )`)
        await query.createTable("user_actions",
     { 
      "id": { "type": Sequelize.INTEGER, "field":"id", "autoIncrement":true, "primaryKey":true, "allowNull":false }, 
      "action": { "type": Sequelize.STRING, "field":"action" }, 
      "method": { "type": Sequelize.STRING, "field":"method" }, 
      "data": { "type": Sequelize.JSON, "field":"data" }, 
      "at": { "type": Sequelize.DATE, "field":"at" }, 
      "dd": { "type": Sequelize.NUMBER, "field":"dd" }, 
      "userId": { "type": Sequelize.INTEGER, "field":"user_id", "onUpdate":"CASCADE", "onDelete":"SET NULL", "references":{"model":"users","key":"id"}, "allowNull":true }
     },
    {})

        log && log(`Processing createTable("user_roles",... )`)
        await query.createTable("user_roles",
     { 
      "UserId": { "type": Sequelize.INTEGER, "field":"user_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"users","key":"id"}, "primaryKey":true }, 
      "RoleId": { "type": Sequelize.INTEGER, "field":"role_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"roles","key":"id"}, "primaryKey":true }
     },
    {})

        log && log(`Processing addIndex("users",... )`)
        await query.addIndex("users",
    ["login"],
    {"indexName":"users_login","name":"users_login","indicesType":"UNIQUE","type":"UNIQUE"})
    }
}
