const { randomUUID } = require('crypto');

// NEW table: Organization → Department → Contacts
module.exports = (sequelize, DataTypes) =>
  sequelize.define('Department', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => randomUUID(),
    },
    name:        { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    modules:     { type: DataTypes.ENUM('ens', 'ers') },
    organization_Id: { type: DataTypes.STRING(255), allowNull: false },
  }, {
    tableName: 'Department',
    timestamps: false,
  });
