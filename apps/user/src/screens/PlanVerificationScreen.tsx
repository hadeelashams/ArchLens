import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, SafeAreaView, ScrollView, 
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { analyzeFloorPlan, extractStructuredData } from '@archlens/shared'; 

interface RoomData {
  id: string;
  name: string;
  length: string;
  width: string;
  area: string; // Add explicit area field
}

export default function PlanVerificationScreen({ route, navigation }: any) {
  const { planImage } = route.params;
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [totalArea, setTotalArea] = useState(0);

  useEffect(() => {
    uploadAndAnalyze();
  }, []);

  const uploadAndAnalyze = async () => {
    try {
      setLoading(true);

      // Convert image URI to base64
      let base64String = planImage;
      
      // If it's a file URI, convert it to base64
      if (planImage.startsWith('file://')) {
        const response = await fetch(planImage);
        const blob = await response.blob();
        
        return new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              base64String = reader.result as string;
              
              // We rely on the specific prompt inside gemini-service now, 
              // but we ensure the extraction schema matches our new expectation.
              const analysis = await analyzeFloorPlan(base64String);
              
              const schema = `{
                "rooms": [
                  {
                    "id": "string",
                    "name": "string",
                    "length": "number",
                    "width": "number",
                    "area": "number"
                  }
                ],
                "totalArea": "number"
              }`;

              const structuredData = await extractStructuredData(analysis, schema);
              
              // Improved JSON cleaning logic
              let cleanedData = structuredData.trim();
              cleanedData = cleanedData.replace(/```json/g, '').replace(/```/g, '');
              const jsonStart = cleanedData.indexOf('{');
              const jsonEnd = cleanedData.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                cleanedData = cleanedData.substring(jsonStart, jsonEnd + 1);
              }

              const parsedData = JSON.parse(cleanedData);

              if (parsedData.rooms && Array.isArray(parsedData.rooms)) {
                const roomsWithIds = parsedData.rooms.map((room: any, index: number) => ({
                  id: room.id || `room-${index}-${Date.now()}`,
                  name: room.name || `Room ${index + 1}`,
                  // Ensure we convert numbers to strings for TextInputs
                  length: String(room.length || '0'),
                  width: String(room.width || '0'),
                  // If area is provided by AI (OCR), use it, otherwise calc
                  area: String(room.area || (room.length * room.width) || '0')
                }));
                setRooms(roomsWithIds);
              } else {
                throw new Error("Invalid structure");
              }
              
              setLoading(false);
              resolve();
            } catch (err: any) {
              console.error("Analysis Error:", err);
              Alert.alert("Analysis Error", "Could not interpret plan details. You may need to enter them manually.");
              // Don't go back, let them enter manually
              setRooms([{ id: '1', name: 'Main Room', length: '0', width: '0', area: '0' }]);
              setLoading(false);
              resolve();
            }
          };
          
          reader.onerror = (error) => {
            console.error("FileReader Error:", error);
            Alert.alert("Error", "Failed to read image file.");
            setLoading(false);
            reject(error);
          };
          
          reader.readAsDataURL(blob);
        });
      } else {
        // If already data URI, process directly
        const analysis = await analyzeFloorPlan(base64String);
        
        const schema = `{
          "rooms": [
            {
              "id": "string",
              "name": "string",
              "length": "number",
              "width": "number",
              "area": "number"
            }
          ],
          "totalArea": "number"
        }`;

        const structuredData = await extractStructuredData(analysis, schema);
        
        // Improved JSON cleaning logic
        let cleanedData = structuredData.trim();
        cleanedData = cleanedData.replace(/```json/g, '').replace(/```/g, '');
        const jsonStart = cleanedData.indexOf('{');
        const jsonEnd = cleanedData.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleanedData = cleanedData.substring(jsonStart, jsonEnd + 1);
        }

        const parsedData = JSON.parse(cleanedData);

        if (parsedData.rooms && Array.isArray(parsedData.rooms)) {
          const roomsWithIds = parsedData.rooms.map((room: any, index: number) => ({
            id: room.id || `room-${index}-${Date.now()}`,
            name: room.name || `Room ${index + 1}`,
            // Ensure we convert numbers to strings for TextInputs
            length: String(room.length || '0'),
            width: String(room.width || '0'),
            // If area is provided by AI (OCR), use it, otherwise calc
            area: String(room.area || (room.length * room.width) || '0')
          }));
          setRooms(roomsWithIds);
        } else {
          throw new Error("Invalid structure");
        }
        
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Analysis Error:", err);
      Alert.alert("Analysis Error", "Could not interpret plan details. You may need to enter them manually.");
      // Don't go back, let them enter manually
      setRooms([{ id: '1', name: 'Main Room', length: '0', width: '0', area: '0' }]);
      setLoading(false);
    }
  };

  // Recalculate total when rooms change
  useEffect(() => {
    const calculatedTotal = rooms.reduce((acc, r) => {
        // Use explicit area if available (better for irregular shapes)
        const l = parseFloat(r.length) || 0;
        const w = parseFloat(r.width) || 0;
        const a = parseFloat(r.area) || 0;
        
        // If user manually edited L/W, prioritize calculation. 
        // If Area is significantly different than L*W (irregular shape), prioritize Area.
        const calculatedArea = l * w;
        
        // Use the manual area if it exists and L/W are 0, OR just sum up.
        // Simplified approach: Sum L*W for consistency in editing
        return acc + calculatedArea; 
    }, 0);
    setTotalArea(calculatedTotal);
  }, [rooms]);

  const updateRoom = (id: string, field: keyof RoomData, value: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== id) return r;
      
      const updatedRoom = { ...r, [field]: value };
      
      // Auto-update area if Length or Width changes
      if (field === 'length' || field === 'width') {
        const l = parseFloat(field === 'length' ? value : r.length) || 0;
        const w = parseFloat(field === 'width' ? value : r.width) || 0;
        updatedRoom.area = (l * w).toFixed(2);
      }
      
      return updatedRoom;
    }));
  };

  const removeRoom = (id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#315b76" />
      <Text style={styles.loadingText}>Reading Floor Plan...</Text>
      <Text style={styles.subLoadingText}>Identifying rooms and dimensions</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify Dimensions</Text>
          <TouchableOpacity onPress={() => setRooms([...rooms, { id: Date.now().toString(), name: 'New Room', length: '0', width: '0', area: '0' }])}>
            <Ionicons name="add-circle" size={28} color="#315b76" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image source={{ uri: planImage }} style={styles.previewImage} resizeMode="contain" />
          
          <Text style={styles.instructionText}>
            Review the extracted dimensions below. Amounts are in Feet.
          </Text>

          {rooms.map((room, index) => (
            <View key={room.id} style={styles.roomCard}>
              <View style={styles.cardHeader}>
                <TextInput
                  style={styles.roomNameInput}
                  value={room.name}
                  onChangeText={(t) => updateRoom(room.id, 'name', t)}
                />
                <TouchableOpacity onPress={() => removeRoom(room.id)}>
                   <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.dimensionsRow}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Length (ft)</Text>
                    <TextInput 
                        style={styles.numInput} 
                        value={room.length} 
                        keyboardType="numeric" 
                        onChangeText={(t) => updateRoom(room.id, 'length', t)} 
                        selectTextOnFocus
                    />
                </View>
                <Text style={styles.xIcon}>×</Text>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Width (ft)</Text>
                    <TextInput 
                        style={styles.numInput} 
                        value={room.width} 
                        keyboardType="numeric" 
                        onChangeText={(t) => updateRoom(room.id, 'width', t)} 
                        selectTextOnFocus
                    />
                </View>
                <View style={styles.areaBadge}>
                  <Text style={styles.areaText}>
                    {parseFloat(room.area).toFixed(0)} sq.ft
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View>
            <Text style={styles.totalLabel}>Estimated Total Area</Text>
            <Text style={styles.totalValue}>{totalArea.toFixed(0)} sq.ft</Text>
          </View>
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={() => {
                navigation.navigate('ConstructionLevel', { 
                  totalArea: totalArea
                });
            }}
          >
            <Text style={styles.confirmText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 15, fontSize: 18, color: '#1e293b', fontWeight: 'bold' },
  subLoadingText: { marginTop: 5, fontSize: 14, color: '#64748b' },
 header: { 
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingVertical: 15,
  backgroundColor: '#F8F9FA'
},

  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  previewImage: { width: '100%', height: 250, borderRadius: 12, marginBottom: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  instructionText: { fontSize: 14, color: '#64748b', marginBottom: 15, fontStyle: 'italic' },
  roomCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  roomNameInput: { fontSize: 16, fontWeight: '700', color: '#315b76', flex: 1, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 4 },
  dimensionsRow: { flexDirection: 'row', alignItems: 'flex-end' },
  inputGroup: { alignItems: 'center' },
  label: { fontSize: 10, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' },
  numInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, width: 70, textAlign: 'center', fontSize: 16, padding: 8, color: '#0f172a', fontWeight: '600' },
  xIcon: { marginHorizontal: 8, marginBottom: 12, fontSize: 16, color: '#94a3b8' },
  areaBadge: { marginLeft: 'auto', backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 2 },
  areaText: { color: '#0284c7', fontWeight: 'bold', fontSize: 14 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  totalLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#315b76' },
  confirmButton: { backgroundColor: '#315b76', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, elevation: 2 },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});