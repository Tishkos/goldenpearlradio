#!/usr/bin/env node

/**
 * Script to replace Supabase imports with API client imports
 * Run with: node scripts/replace-supabase.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const clientDir = path.join(__dirname, '..', 'client', 'src');

// Find all TypeScript/TSX files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

const files = findFiles(clientDir);
let updatedCount = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Replace import statements
  if (content.includes("from '@/lib/supabase'") || content.includes('from "@/lib/supabase"')) {
    // Remove supabase import
    content = content.replace(/import\s+{\s*supabase[^}]*}\s+from\s+['"]@\/lib\/supabase['"];?\n?/g, '');
    content = content.replace(/import\s+supabase\s+from\s+['"]@\/lib\/supabase['"];?\n?/g, '');
    
    // Add api-client import if not already present
    if (!content.includes("from '@/lib/api-client'") && !content.includes('from "@/lib/api-client"')) {
      // Find the last import statement
      const importMatch = content.match(/^import\s+.*$/m);
      if (importMatch) {
        const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length;
        content = content.slice(0, lastImportIndex) + "\nimport { api } from '@/lib/api-client';" + content.slice(lastImportIndex);
      } else {
        content = "import { api } from '@/lib/api-client';\n" + content;
      }
    }
    modified = true;
  }
  
  // Replace supabase queries with API calls (basic patterns)
  // This is a simple replacement - you may need to manually adjust complex queries
  if (content.includes('supabase.from(')) {
    console.log(`⚠️  File ${filePath} contains supabase.from() calls that need manual review`);
  }
  
  if (content.includes('supabase.auth.')) {
    console.log(`⚠️  File ${filePath} contains supabase.auth calls that need manual review`);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedCount++;
    console.log(`✓ Updated: ${path.relative(clientDir, filePath)}`);
  }
});

console.log(`\n✅ Updated ${updatedCount} files`);
console.log('⚠️  Please review files with supabase.from() or supabase.auth calls manually');

