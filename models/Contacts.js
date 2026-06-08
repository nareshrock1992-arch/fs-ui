const { randomUUID } = require('crypto');

module.exports = (sequelize, DataTypes) =>
  sequelize.define('Contacts', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => randomUUID(),
    },
    name:    { type: DataTypes.STRING(255), allowNull: false },
    role:    { type: DataTypes.STRING(255), allowNull: false },
    phone:   { type: DataTypes.STRING(255), allowNull: false },
    email:   { type: DataTypes.STRING(255) },
    organization_Id: { type: DataTypes.STRING(255), allowNull: false },
    department_Id:   { type: DataTypes.STRING(255) }, // NEW (nullable)
    modules: { type: DataTypes.ENUM('ens', 'ers'), allowNull: false },
  }, {
    tableName: 'Contacts',
    timestamps: false,
  });
