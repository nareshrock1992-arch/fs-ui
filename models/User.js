// users — application login accounts (Admin / User). Separate from Contacts.
module.exports = (sequelize, DataTypes) =>
  sequelize.define('User', {
    id:       { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name:     { type: DataTypes.STRING(255), allowNull: false },
    email:    { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role:     { type: DataTypes.ENUM('Admin', 'User'), allowNull: false, defaultValue: 'User' },
    active:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    timeZone: { type: DataTypes.STRING(255), defaultValue: 'UTC' },
  }, {
    tableName: 'users',
    timestamps: true, // createdAt / updatedAt
  });
