
const Sequelize = require("sequelize")
module.exports = {
    info : {"revision":1,"name":"test","file":"001-test","created":"2021-06-20T03:08:13.210Z"},
    async up(query, log)
    {
        
        log && log(`Processing createTable("groups",... )`)
        await query.createTable("groups",
     { 
      "id": { "type": Sequelize.INTEGER, "field":"id", "autoIncrement":true, "primaryKey":true, "allowNull":false }, 
      "name": { "type": Sequelize.STRING, "field":"name" }
     },
    {})

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
      "id": { "type": Sequelize.STRING, "field":"id", "primaryKey":true }, 
      "no": { "type": Sequelize.INTEGER, "field":"no" }, 
      "name": { "type": Sequelize.STRING, "field":"name" }, 
      "email": { "type": Sequelize.STRING, "field":"email" }, 
      "mobile": { "type": Sequelize.STRING, "field":"mobile" }, 
      "password": { "type": Sequelize.STRING, "field":"password" }, 
      "isAdmin": { "type": Sequelize.BOOLEAN, "field":"is_admin" }, 
      "blocked": { "type": Sequelize.BOOLEAN, "field":"blocked" }, 
      "createdAt": { "type": Sequelize.DATE, "field":"created_at", "allowNull":false }, 
      "updatedAt": { "type": Sequelize.DATE, "field":"updated_at", "allowNull":false }, 
      "deletedAt": { "type": Sequelize.DATE, "field":"deleted_at" }
     },
    {})

        log && log(`Processing createTable("group_roles",... )`)
        await query.createTable("group_roles",
     { 
      "GroupId": { "type": Sequelize.INTEGER, "field":"group_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"groups","key":"id"}, "primaryKey":true }, 
      "RoleId": { "type": Sequelize.INTEGER, "field":"role_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"roles","key":"id"}, "primaryKey":true }
     },
    {})

        log && log(`Processing createTable("resumes",... )`)
        await query.createTable("resumes",
     { 
      "id": { "type": Sequelize.INTEGER, "field":"id", "autoIncrement":true, "primaryKey":true, "allowNull":false }, 
      "content": { "type": Sequelize.TEXT, "field":"content" }, 
      "ownerId": { "type": Sequelize.STRING, "field":"owner_id", "onUpdate":"CASCADE", "onDelete":"SET NULL", "references":{"model":"users","key":"id"}, "allowNull":true }
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
      "userId": { "type": Sequelize.STRING, "field":"user_id", "onUpdate":"CASCADE", "onDelete":"SET NULL", "references":{"model":"users","key":"id"}, "allowNull":true }
     },
    {})

        log && log(`Processing createTable("user_groups",... )`)
        await query.createTable("user_groups",
     { 
      "isLeader": { "type": Sequelize.BOOLEAN, "field":"is_leader", "defaultValue":false, "allowNull":false }, 
      "groupId": { "type": Sequelize.INTEGER, "allowNull":true, "field":"group_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"groups","key":"id"}, "primaryKey":true }, 
      "userId": { "type": Sequelize.STRING, "allowNull":true, "field":"user_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"users","key":"id"}, "primaryKey":true }
     },
    {})

        log && log(`Processing createTable("user_roles",... )`)
        await query.createTable("user_roles",
     { 
      "userId": { "type": Sequelize.STRING, "field":"user_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"users","key":"id"}, "primaryKey":true }, 
      "RoleId": { "type": Sequelize.INTEGER, "field":"role_id", "onUpdate":"CASCADE", "onDelete":"CASCADE", "references":{"model":"roles","key":"id"}, "primaryKey":true }
     },
    {})

        log && log(`Processing addIndex("resumes",... )`)
        await query.addIndex("resumes",
    ["owner_id"],
    {"indexName":"resumes_owner_id","name":"resumes_owner_id","indicesType":"UNIQUE","type":"UNIQUE"})

        log && log(`Processing addIndex("users",... )`)
        await query.addIndex("users",
    ["mobile"],
    {"indexName":"users_mobile","name":"users_mobile","indicesType":"UNIQUE","type":"UNIQUE"})

        log && log(`Processing addIndex("users",... )`)
        await query.addIndex("users",
    ["email"],
    {"indexName":"users_email","name":"users_email","indicesType":"UNIQUE","type":"UNIQUE"})
    }
}
