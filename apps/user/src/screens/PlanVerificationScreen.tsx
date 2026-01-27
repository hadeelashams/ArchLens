import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, SafeAreaView, ScrollView, 
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { analyzeFloorPlan, extractStructuredData, auth } from '@archlens/shared'; 
import { createProject } from '../services/projectService';

interface RoomData {
  id: string;
  name: string;
  length: string;
  width: string;
  area: string; // explicit area field
}

export default function PlanVerificationScreen({ route, navigation }: any) {
  const { planImage } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // New state for saving process
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [totalArea, setTotalArea] = useState(0);

  useEffect(() => {
    uploadAndAnalyze();
  }, []);

  // --- RECALCULATE TOTAL WHENEVER ROOMS CHANGE ---
  useEffect(() => {
    const calculatedTotal = rooms.reduce((acc, r) => {
        // Parse the string area to float
        const a = parseFloat(r.area);
        // Add to accumulator, treating NaN as 0
        return acc + (isNaN(a) ? 0 : a);
    }, 0);
    
    // Fix to 2 decimal places to avoid floating point errors (e.g. 1200.000004)
    setTotalArea(Number(calculatedTotal.toFixed(2)));
  }, [rooms]);

  const uploadAndAnalyze = async () => {
    try {
      setLoading(true);

      // 1. Prepare Base64
      let base64String = planImage;
      if (planImage.startsWith('file://')) {
        const response = await fetch(planImage);
        const blob = await response.blob();
        base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
      }

      // 2. Call AI
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
      
      // 3. Clean JSON
      let cleanedData = structuredData.trim();
      cleanedData = cleanedData.replace(/```json/g, '').replace(/```/g, '');
      const jsonStart = cleanedData.indexOf('{');
      const jsonEnd = cleanedData.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanedData = cleanedData.substring(jsonStart, jsonEnd + 1);
      }

      const parsedData = JSON.parse(cleanedData);

      // 4. Map to State
      if (parsedData.rooms && Array.isArray(parsedData.rooms)) {
        const roomsWithIds = parsedData.rooms.map((room: any, index: number) => ({
          id: room.id || `room-${index}-${Date.now()}`,
          name: room.name || `Room ${index + 1}`,
          length: String(room.length || '0'),
          width: String(room.width || '0'),
          // Priority: AI Provided Area > Calc Area > 0
          area: String(room.area || (room.length * room.width) || '0')
        }));
        setRooms(roomsWithIds);
      } else {
        throw new Error("Invalid structure");
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      Alert.alert("Analysis Error", "Could not interpret plan details. Please enter manually.");
      setRooms([{ id: '1', name: 'Main Room', length: '0', width: '0', area: '0' }]);
      setLoading(false);
    }
  };

  const updateRoom = (id: string, field: keyof RoomData, value: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== id) return r;
      
      const updatedRoom = { ...r, [field]: value };
      
      // Auto-calculate Area if Length or Width changes
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

  // --- SAVE TO FIREBASE HANDLER ---
  const handleVerifyAndSave = async () => {
    if (!auth.currentUser) {
      Alert.alert("Login Required", "You must be logged in to save this project.");
      return;
    }

    setSaving(true);
    try {
      const projectData = {
        userId: auth.currentUser.uid,
        name: `Floor Plan ${new Date().toLocaleDateString()}`,
        status: 'active' as const,
        totalArea: totalArea,
        rooms: rooms
        // planImageUrl: could upload to storage here if needed
      };

      const newProjectId = await createProject(projectData);

      setSaving(false);
      
      // Navigate to next screen passing the new Project ID
      navigation.navigate('ConstructionLevel', { 
        totalArea: totalArea,
        projectId: newProjectId 
      });

    } catch (error: any) {
      setSaving(false);
      Alert.alert("Save Error", error.message);
    }
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

          {rooms.map((room) => (
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
                
                {/* Area Input - Editable for corrections */}
                <View style={styles.areaBadge}>
                   <TextInput
                      style={styles.areaInput}
                      value={room.area}
                      keyboardType="numeric"
                      onChangeText={(t) => updateRoom(room.id, 'area', t)}
                   />
                   <Text style={styles.areaUnit}>sq.ft</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View>
            <Text style={styles.totalLabel}>Estimated Total Area</Text>
            <Text style={styles.totalValue}>{totalArea.toFixed(2)} sq.ft</Text>
          </View>
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={handleVerifyAndSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.confirmText}>Verify & Save</Text>
            )}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#F8F9FA'
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
  areaBadge: { marginLeft: 'auto', backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 2, flexDirection: 'row', alignItems: 'baseline' },
  areaInput: { color: '#0284c7', fontWeight: 'bold', fontSize: 16, minWidth: 40, textAlign: 'right' },
  areaUnit: { color: '#0284c7', fontSize: 12, marginLeft: 4, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  totalLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#315b76' },
  confirmButton: { backgroundColor: '#315b76', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, elevation: 2, minWidth: 120, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});