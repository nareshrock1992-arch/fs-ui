const { randomUUID } = require('crypto');

// "Responder" acts as a Group of Contacts (members via ResponderContacts).
module.exports = (sequelize, DataTypes) =>
  sequelize.define('Responder', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => randomUUID(),
    },
    name:        { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: false },
    modules:     { type: DataTypes.ENUM('ens', 'ers') },
    organization_Id: { type: DataTypes.STRING(255), allowNull: false },
  }, {
    tableName: 'Responder',
    timestamps: false,
  });
