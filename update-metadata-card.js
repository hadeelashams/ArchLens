const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/user/src/screens/WallScreen.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Update the metadata card title and add AI detection badge
content = content.replace(
  '<Text style={styles.metadataInfoTitle}>📊 Wall Composition</Text>\n              {rooms && rooms.length > 0 && (\n                <View style={{marginLeft: 8, backgroundColor: \'#10b981\', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4}}>\n                  <Text style={{color: \'#fff\', fontSize: 8, fontWeight: \'700\'}}>From Rooms</Text>\n                </View>\n              )}',
  '<Text style={styles.metadataInfoTitle}>📊 AI-Detected Wall Composition</Text>\n              {isDetectingComposition && (\n                <ActivityIndicator size="small" color="#315b76" />\n              )}\n              {compositionDetected && !isDetectingComposition && (\n                <View style={{marginLeft: 8, backgroundColor: \'#10b981\', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4}}>\n                  <Text style={{color: \'#fff\', fontSize: 8, fontWeight: \'700\'}}>✓ Analyzed</Text>\n                </View>\n              )}'
);

// Update the metadataInfoCard style to handle loading state
content = content.replace(
  '<View style={styles.metadataInfoCard}>',
  '<View style={[styles.metadataInfoCard, isDetectingComposition && {opacity: 0.8}]}>'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('✓ Updated WallScreen.tsx metadata card with AI detection status');
