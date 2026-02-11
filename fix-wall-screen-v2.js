const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/user/src/screens/WallScreen.tsx');

// Read the file
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

// Remove line 515 (index 514) - the floating )}
lines.splice(514, 1);

// Write the file back
fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log('✓ Removed floating )} from WallScreen.tsx');
