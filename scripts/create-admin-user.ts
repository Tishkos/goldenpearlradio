import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const email = (process.env.ADMIN_EMAIL || "admin@radio.com").trim();
    const username = (process.env.ADMIN_USERNAME || "admin").trim();
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const fullName = process.env.ADMIN_FULL_NAME || "Admin User";

    if (!email || !username || !password) {
      throw new Error("ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD must be non-empty.");
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: existing.id },
        data: {
          isAdmin: true,
          password: hashedPassword,
          fullName,
          email,
          username,
        },
      });

      console.log("Admin user already existed. Updated admin flag and password.");
      console.log(`Email: ${email}`);
      console.log(`Username: ${username}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        fullName,
        isAdmin: true,
      },
    });

    console.log("Admin user created successfully.");
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log("Password: (the ADMIN_PASSWORD you provided)");
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
