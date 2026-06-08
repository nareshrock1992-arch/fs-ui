// Join table for Responder ↔ Contacts (has createdAt/updatedAt).
module.exports = (sequelize, DataTypes) =>
  sequelize.define('ResponderContacts', {
    ResponderId: { type: DataTypes.STRING(255), primaryKey: true },
    ContactId:   { type: DataTypes.STRING(255), primaryKey: true },
  }, {
    tableName: 'ResponderContacts',
    timestamps: true,
  });
