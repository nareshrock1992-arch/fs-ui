const { randomUUID } = require('crypto');

module.exports = (sequelize, DataTypes) =>
  sequelize.define('Organization', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => randomUUID(),
    },
    name:        { type: DataTypes.STRING(255), allowNull: false },
    type:        { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    active:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    modules:     { type: DataTypes.ENUM('ens', 'ers') },
  }, {
    tableName: 'Organization',
    timestamps: false,
  });
