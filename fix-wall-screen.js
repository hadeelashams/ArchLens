const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/user/src/screens/WallScreen.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');

// Fix the issue: remove the floating)} and replace with closing </View>
// The pattern is: ...)}\n          \n          {/* 1. Dimensions

content = content.replace(
  /            <\/View>\n          \)}\n          \n          {\/\* 1\. Dimensions/,
  '            </View>\n          </View>\n          \n          {/* 1. Dimensions'
);

// Write the file back
fs.writeFileSync(filePath, content, 'utf-8');
console.log('✓ Fixed WallScreen.tsx syntax error');
