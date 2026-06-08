const { randomUUID } = require('crypto');

module.exports = (sequelize, DataTypes) =>
  sequelize.define('ENS', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => randomUUID(),
    },
    name:         { type: DataTypes.STRING(255), allowNull: false },
    pin:          { type: DataTypes.STRING(255), allowNull: false },
    responders:   { type: DataTypes.JSONB, allowNull: false },
    active:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    phone:        { type: DataTypes.STRING(255), allowNull: false },
    retry_number: { type: DataTypes.STRING(255) },
    retry:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    organization_Id: { type: DataTypes.STRING(255), allowNull: false },
  }, {
    tableName: 'ENS',
    timestamps: false,
  });
