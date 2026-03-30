import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const email = 'admin@radio.com';
    const username = 'admin';
    const password = 'admin123';
    const fullName = 'Admin User';

    // Check if admin already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existing) {
      // Ensure admin privileges are set
      if (!existing.isAdmin) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { isAdmin: true }
        });
        console.log('✅ Admin privileges granted to existing user!');
      } else {
        console.log('✅ Admin user already exists with admin privileges!');
      }
      console.log(`Email: ${email}`);
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        fullName,
        isAdmin: true,
      }
    });

    console.log('✅ Admin user created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();

