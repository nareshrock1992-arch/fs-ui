const { randomUUID } = require('crypto');

module.exports = (sequelize, DataTypes) =>
  sequelize.define('ERS', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => randomUUID(),
    },
    name:       { type: DataTypes.STRING(255), allowNull: false },
    responders: { type: DataTypes.JSONB, allowNull: false },
    active:     { type: DataTypes.BOOLEAN, defaultValue: false },
    phone:      { type: DataTypes.STRING(255), allowNull: false },
    retry:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    retry_number: {
      type: DataTypes.JSONB,
      defaultValue: { primary: null, secondary: null },
    },
    organization_Id: { type: DataTypes.STRING(255), allowNull: false },
  }, {
    tableName: 'ERS',
    timestamps: false,
  });
