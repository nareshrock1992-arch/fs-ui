const { randomUUID } = require('crypto');

module.exports = (sequelize, DataTypes) =>
  sequelize.define('Location', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => randomUUID(),
    },
    name:    { type: DataTypes.STRING(255), allowNull: false },
    modules: { type: DataTypes.ENUM('ens', 'ers') },
    organization_Id: { type: DataTypes.STRING(255), allowNull: false },
  }, {
    tableName: 'Location',
    timestamps: false,
  });
