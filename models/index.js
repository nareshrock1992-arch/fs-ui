/**
 * models/index.js — Sequelize instance + model registration.
 *
 * Models mirror the existing `omni_schema` tables (Organization, Contacts,
 * Responder, ENS, ERS, Location, Room, blast_logs, users) plus a NEW
 * `Department` table (Organization → Department → Contacts).
 *
 * Reuses the same DB_* env vars as db.js. Only the new Department table is
 * created via sync(); the pre-existing omni tables are never altered here.
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'freeswitch_dashboard',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
    define: { timestamps: false, freezeTableName: true },
  }
);

// ── Models ────────────────────────────────────────────────────
const Organization      = require('./Organization')(sequelize, DataTypes);
const Department         = require('./Department')(sequelize, DataTypes);
const Contacts          = require('./Contacts')(sequelize, DataTypes);
const Responder         = require('./Responder')(sequelize, DataTypes);
const ResponderContacts = require('./ResponderContacts')(sequelize, DataTypes);
const ENS               = require('./ENS')(sequelize, DataTypes);
const ERS               = require('./ERS')(sequelize, DataTypes);
const Location          = require('./Location')(sequelize, DataTypes);
const Room              = require('./Room')(sequelize, DataTypes);
const BlastLog          = require('./BlastLog')(sequelize, DataTypes);
const User              = require('./User')(sequelize, DataTypes);

// ── Associations ──────────────────────────────────────────────
Organization.hasMany(Department, { foreignKey: 'organization_Id', onDelete: 'CASCADE' });
Department.belongsTo(Organization, { foreignKey: 'organization_Id' });

Organization.hasMany(Contacts, { foreignKey: 'organization_Id', onDelete: 'CASCADE' });
Contacts.belongsTo(Organization, { foreignKey: 'organization_Id' });

Department.hasMany(Contacts, { foreignKey: 'department_Id', onDelete: 'SET NULL' });
Contacts.belongsTo(Department, { foreignKey: 'department_Id' });

Organization.hasMany(Responder, { foreignKey: 'organization_Id', onDelete: 'CASCADE' });
Responder.belongsTo(Organization, { foreignKey: 'organization_Id' });

// Responder ↔ Contacts (groups ↔ members)
Responder.belongsToMany(Contacts, { through: ResponderContacts, foreignKey: 'ResponderId', otherKey: 'ContactId' });
Contacts.belongsToMany(Responder, { through: ResponderContacts, foreignKey: 'ContactId', otherKey: 'ResponderId' });

Organization.hasMany(ENS, { foreignKey: 'organization_Id', onDelete: 'CASCADE' });
ENS.belongsTo(Organization, { foreignKey: 'organization_Id' });
Organization.hasMany(ERS, { foreignKey: 'organization_Id', onDelete: 'CASCADE' });
ERS.belongsTo(Organization, { foreignKey: 'organization_Id' });

Organization.hasMany(Location, { foreignKey: 'organization_Id', onDelete: 'CASCADE' });
Location.belongsTo(Organization, { foreignKey: 'organization_Id' });
Location.hasMany(Room, { foreignKey: 'locations_Id', onDelete: 'CASCADE' });
Room.belongsTo(Location, { foreignKey: 'locations_Id' });
Organization.hasMany(Room, { foreignKey: 'organization_Id', onDelete: 'CASCADE' });
Room.belongsTo(Organization, { foreignKey: 'organization_Id' });

/**
 * Verify connection, create the new Department table if missing, and add the
 * Contacts.department_Id column/FK if it isn't there yet. Existing omni tables
 * are left untouched.
 */
async function initModels() {
  await sequelize.authenticate();
  await Department.sync();

  const qi = sequelize.getQueryInterface();
  const contactsCols = await qi.describeTable('Contacts');
  if (!contactsCols.department_Id) {
    await sequelize.query(
      'ALTER TABLE "Contacts" ADD COLUMN "department_Id" character varying(255) ' +
      'REFERENCES "Department"(id) ON UPDATE CASCADE ON DELETE SET NULL'
    );
  }
  console.log('[models] Sequelize models ready.');
}

module.exports = {
  sequelize,
  Sequelize,
  initModels,
  Organization,
  Department,
  Contacts,
  Responder,
  ResponderContacts,
  ENS,
  ERS,
  Location,
  Room,
  BlastLog,
  User,
};
