import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function verifyAdmin() {
  try {
    const email = 'admin@radio.com';
    
    // Find admin user
    const admin = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: 'admin' }
        ]
      }
    });

    if (!admin) {
      console.log('❌ Admin user not found!');
      return;
    }

    console.log('\n📋 Current Admin User Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID:       ${admin.id}`);
    console.log(`Email:    ${admin.email}`);
    console.log(`Username: ${admin.username}`);
    console.log(`Full Name: ${admin.fullName || 'N/A'}`);
    console.log(`Is Admin: ${admin.isAdmin ? '✅ YES' : '❌ NO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!admin.isAdmin) {
      console.log('\n⚠️  Admin user does not have admin privileges!');
      console.log('Updating to admin...');
      
      await prisma.user.update({
        where: { id: admin.id },
        data: { isAdmin: true }
      });

      console.log('✅ Admin privileges granted!');
    } else {
      console.log('\n✅ Admin user has admin privileges!');
    }

    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${admin.email}`);
    console.log(`Username: ${admin.username}`);
    console.log(`Password: admin123`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Admin can access:');
    console.log('  - /admin (Admin Dashboard)');
    console.log('  - All admin API endpoints');
    console.log('  - All protected routes');

  } catch (error) {
    console.error('❌ Error verifying admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdmin();

