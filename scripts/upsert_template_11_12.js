/*
 * Upsert de configuraciones visual/content para templates 11 y 12.
 *
 * Requiere:
 * - Archivos payload copiados dentro del contenedor Mongo en:
 *   /tmp/payload-template-2.json
 *   /tmp/payload-template-xv-2.json
 *
 * Ejecucion esperada:
 * mongosh mongodb://.../invitaciones?authSource=admin /tmp/upsert_template_11_12.js
 */

const fs = require("fs");

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const payloadWedding = readJson("/tmp/payload-template-2.json");
const payloadXv = readJson("/tmp/payload-template-xv-2.json");

payloadWedding.visualConfig.templateId = 11;
payloadWedding.visualConfig.eventId = 1;
payloadWedding.visualConfig.planId = 2;
payloadWedding.visualConfig.invitationId = 0;
payloadWedding.contentConfig.templateId = 11;

payloadXv.visualConfig.templateId = 12;
payloadXv.visualConfig.eventId = 2;
payloadXv.visualConfig.planId = 2;
payloadXv.visualConfig.invitationId = 0;
payloadXv.contentConfig.templateId = 12;

const invitacionesDb = db.getSiblingDB("invitaciones");

invitacionesDb.default_visual_configs.updateOne(
  { templateId: NumberLong("11") },
  {
    $set: {
      templateId: NumberLong("11"),
      config: payloadWedding.visualConfig,
    },
  },
  { upsert: true },
);

invitacionesDb.default_visual_configs.updateOne(
  { templateId: NumberLong("12") },
  {
    $set: {
      templateId: NumberLong("12"),
      config: payloadXv.visualConfig,
    },
  },
  { upsert: true },
);

invitacionesDb.default_content_configs.updateOne(
  { templateId: NumberLong("11") },
  { $set: payloadWedding.contentConfig },
  { upsert: true },
);

invitacionesDb.default_content_configs.updateOne(
  { templateId: NumberLong("12") },
  { $set: payloadXv.contentConfig },
  { upsert: true },
);

print("upsert done for templates 11 and 12");
