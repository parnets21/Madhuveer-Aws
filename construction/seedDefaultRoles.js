const mongoose = require("mongoose");
const Role = require("./models/Role");
require("dotenv").config();

const defaultRoles = [
  {
    name: "Site Supervisor",
    value: "sitesupervisor",
    description: "Manages site operations and workers",
    type: "construction",
    isDefault: true,
    status: "active",
  },
  {
    name: "Project Manager",
    value: "projectmanager",
    description: "Oversees project planning and execution",
    type: "construction",
    isDefault: true,
    status: "active",
  },
  {
    name: "HR",
    value: "hr",
    description: "Manages human resources and employee relations",
    type: "construction",
    isDefault: true,
    status: "active",
  },
];

async function seedRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if default roles already exist
    const existingRoles = await Role.find({ type: "construction", isDefault: true });
    
    if (existingRoles.length > 0) {
      console.log("ℹ️  Default roles already exist. Skipping seed.");
      process.exit(0);
    }

    // Insert default roles
    await Role.insertMany(defaultRoles);
    console.log("✅ Default roles seeded successfully!");
    console.log(`   - ${defaultRoles.length} roles created`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding roles:", error);
    process.exit(1);
  }
}

seedRoles();
