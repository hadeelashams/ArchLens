import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, ScrollView, 
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform,
  Modal, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { analyzeFloorPlan, extractStructuredData, auth } from '@archlens/shared'; 
import { useAIAnalysis } from '../context/AIAnalysisContext';
import { createProject } from '../services/projectService';

interface RoomData {
  id: string;
  name: string;
  length: string;
  width: string;
  area: string;
  roomType?: "standard" | "balcony" | "wash_area";
  wallMetadata?: {
    mainWallRatio: number;
    partitionWallRatio: number;
  };
  openingPercentage?: number;
  features?: string[];
}

export default function PlanVerificationScreen({ route, navigation }: any) {
  const { planImage } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [totalArea, setTotalArea] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // --- NEW STATE FOR ZOOM MODAL ---
  const [isZoomVisible, setZoomVisible] = useState(false);

  const { getCachedFloorPlanAnalysis, cacheFloorPlanAnalysis } = useAIAnalysis();

  useEffect(() => {
    uploadAndAnalyze();
  }, []);

  useEffect(() => {
    const calculatedTotal = rooms.reduce((acc, r) => {
        const a = parseFloat(r.area);
        return acc + (isNaN(a) ? 0 : a);
    }, 0);
    // Multiply by 1.15 to convert Carpet Area to Built-up Area (includes wall thickness)
    setTotalArea(Number((calculatedTotal * 1.15).toFixed(2)));
  }, [rooms]);

  const uploadAndAnalyze = async () => {
    try {
      setLoading(true);
      setAnalysisError(null);

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

      // CHECK CACHE FIRST
      const cachedAnalysis = getCachedFloorPlanAnalysis(base64String);
      if (cachedAnalysis) {
        console.log('Using cached floor plan analysis');
        const roomsWithIds = (cachedAnalysis.data.rooms || []).map((room: any, index: number) => ({
          id: room.id || `room-${index}-${Date.now()}`,
          name: room.name || `Room ${index + 1}`,
          length: String(room.length || '0'),
          width: String(room.width || '0'),
          area: String(room.area || (room.length * room.width) || '0'),
          roomType: room.roomType || 'standard',
          wallMetadata: room.wallMetadata || { mainWallRatio: 0.6, partitionWallRatio: 0.4 },
          openingPercentage: room.openingPercentage || 20,
          features: room.features || []
        }));
        setRooms(roomsWithIds);
        setIsCached(true);
        setLoading(false);
        return;
      }

      const analysis = await analyzeFloorPlan(base64String);
      
      const schema = `{
        "rooms": [
          {
            "id": "string",
            "name": "string",
            "length": "number",
            "width": "number",
            "area": "number",
            "roomType": "standard | balcony | wash_area",
            "wallMetadata": {
              "mainWallRatio": "number",
              "partitionWallRatio": "number"
            },
            "openingPercentage": "number",
            "features": ["string"]
          }
        ],
        "totalArea": "number"
      }`;

      const structuredData = await extractStructuredData(analysis, schema);
      
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
          length: String(room.length || '0'),
          width: String(room.width || '0'),
          area: String(room.area || (room.length * room.width) || '0'),
          roomType: room.roomType || 'standard',
          wallMetadata: room.wallMetadata || { mainWallRatio: 0.6, partitionWallRatio: 0.4 },
          openingPercentage: room.openingPercentage || 20,
          features: room.features || []
        }));
        setRooms(roomsWithIds);

        // CACHE THE ANALYSIS
        cacheFloorPlanAnalysis(base64String, {
          id: `analysis-${Date.now()}`,
          type: 'floor_plan',
          timestamp: Date.now(),
          data: parsedData,
        });

        setIsCached(false);
      } else {
        throw new Error("Invalid structure");
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      
      // Handle quota errors with user-friendly message
      if (err.message === 'AI_QUOTA_EXCEEDED' || err.message?.includes('quota') || err.message?.includes('429')) {
        setAnalysisError('AI quota limit reached. Please skip and enter dimensions manually.');
      } else {
        setAnalysisError(err.message || 'Could not interpret plan details. You can skip and enter manually.');
      }
      
      setRooms([{ id: '1', name: 'Main Room', length: '0', width: '0', area: '0' }]);
      setLoading(false);
    }
  };

  const handleSkipAI = () => {
    Alert.alert(
      'Skip AI Analysis',
      'You can manually enter room dimensions. Continue?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Continue',
          onPress: () => {
            // Clear rooms and start fresh with manual entry
            setRooms([
              {
                id: `room-${Date.now()}`,
                name: 'Room 1',
                length: '0',
                width: '0',
                area: '0',
              },
            ]);
            setAnalysisError(null);
          },
        },
      ]
    );
  };

  const updateRoom = (id: string, field: keyof RoomData, value: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== id) return r;
      
      const updatedRoom = { ...r, [field]: value };
      
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
      };

      const newProjectId = await createProject(projectData);

      setSaving(false);
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

  if (analysisError) {
    const isQuotaError = analysisError.includes('quota') || analysisError.includes('limit reached');
    
    return (
      <View style={styles.errorContainer}>
        <Ionicons 
          name={isQuotaError ? "flash-off" : "alert-circle"} 
          size={64} 
          color={isQuotaError ? "#f59e0b" : "#ef4444"} 
        />
        <Text style={styles.errorTitle}>
          {isQuotaError ? 'AI Quota Limit Reached' : 'Analysis Failed'}
        </Text>
        <Text style={styles.errorMessage}>{analysisError}</Text>
        {isQuotaError && (
          <View style={styles.quotaInfoBox}>
            <Ionicons name="information-circle" size={20} color="#0284c7" />
            <Text style={styles.quotaInfoText}>
              Don't worry! You can manually enter room dimensions below.
            </Text>
          </View>
        )}
        <View style={styles.errorButtonRow}>
          {!isQuotaError && (
            <TouchableOpacity style={styles.retryButton} onPress={uploadAndAnalyze}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.skipErrorButton, isQuotaError && styles.skipErrorButtonPrimary]} 
            onPress={handleSkipAI}
          >
            <Ionicons name="create" size={18} color={isQuotaError ? "#fff" : "#315b76"} />
            <Text style={[styles.skipErrorButtonText, isQuotaError && styles.skipErrorButtonTextPrimary]}>
              Manual Entry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify Dimensions</Text>
          <View style={styles.headerRight}>
            {isCached && <Text style={styles.cachedBadge}>From Cache</Text>}
            <TouchableOpacity onPress={() => setRooms([...rooms, { id: Date.now().toString(), name: 'New Room', length: '0', width: '0', area: '0' }])}>
              <Ionicons name="add-circle" size={28} color="#315b76" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* --- UPDATED IMAGE SECTION --- */}
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => setZoomVisible(true)}
            style={styles.imageContainer}
          >
            <Image source={{ uri: planImage }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.zoomIconOverlay}>
              <Ionicons name="expand-outline" size={24} color="#fff" />
              <Text style={styles.zoomText}>Tap to Zoom</Text>
            </View>
          </TouchableOpacity>
          {/* ----------------------------- */}

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

              {/* --- AI EXTRACTED METADATA --- */}
              <View style={styles.metadataSection}>
                <Text style={styles.metadataTitle}>AI Analysis - Metadata</Text>
                
                {/* Room Type */}
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>Room Type:</Text>
                  <Text style={[styles.metadataValue, { 
                    backgroundColor: room.roomType === 'balcony' ? '#fef3c7' : room.roomType === 'wash_area' ? '#dbeafe' : '#f0fdf4',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6
                  }]}>
                    {room.roomType || 'standard'}
                  </Text>
                </View>

                {/* Wall Metadata - Load Bearing Ratio */}
                {room.wallMetadata && (
                  <>
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabel}>Load-Bearing Wall:</Text>
                      <View style={styles.ratioBar}>
                        <View style={{
                          width: `${(room.wallMetadata.mainWallRatio || 0) * 100}%`,
                          backgroundColor: '#ef4444',
                          height: '100%',
                          borderRadius: 4
                        }} />
                      </View>
                      <Text style={styles.ratioValue}>{((room.wallMetadata.mainWallRatio || 0) * 100).toFixed(0)}%</Text>
                    </View>

                    {/* Wall Metadata - Partition Ratio */}
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabel}>Partition Wall:</Text>
                      <View style={styles.ratioBar}>
                        <View style={{
                          width: `${(room.wallMetadata.partitionWallRatio || 0) * 100}%`,
                          backgroundColor: '#3b82f6',
                          height: '100%',
                          borderRadius: 4
                        }} />
                      </View>
                      <Text style={styles.ratioValue}>{((room.wallMetadata.partitionWallRatio || 0) * 100).toFixed(0)}%</Text>
                    </View>
                  </>
                )}

                {/* Opening Percentage */}
                {room.openingPercentage !== undefined && (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Window/Door:</Text>
                    <View style={styles.ratioBar}>
                      <View style={{
                        width: `${Math.min(room.openingPercentage, 100)}%`,
                        backgroundColor: '#f59e0b',
                        height: '100%',
                        borderRadius: 4
                      }} />
                    </View>
                    <Text style={styles.ratioValue}>{Math.round(room.openingPercentage)}%</Text>
                  </View>
                )}
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

        {/* --- ZOOM MODAL --- */}
        <Modal 
          visible={isZoomVisible} 
          transparent={true} 
          animationType="fade"
          onRequestClose={() => setZoomVisible(false)}
        >
          <View style={styles.modalBackground}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setZoomVisible(false)}>
              <Ionicons name="close-circle" size={40} color="#fff" />
            </TouchableOpacity>
            
            <ScrollView
              contentContainerStyle={styles.zoomScrollContent}
              maximumZoomScale={4.0}
              minimumZoomScale={1.0}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent={true}
            >
              <Image 
                source={{ uri: planImage }} 
                style={styles.fullScreenImage} 
                resizeMode="contain" 
              />
            </ScrollView>
          </View>
        </Modal>
        {/* ------------------ */}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20 },
  loadingText: { marginTop: 15, fontSize: 18, color: '#1e293b', fontWeight: 'bold' },
  subLoadingText: { marginTop: 5, fontSize: 14, color: '#64748b', marginBottom: 30 },
  skipButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ef4444', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 10, 
    gap: 8,
    marginTop: 20 
  },
  skipButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 30 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginTop: 20, marginBottom: 8 },
  errorMessage: { fontSize: 15, color: '#64748b', marginTop: 8, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  quotaInfoBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#e0f2fe', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 25, 
    gap: 10,
    borderWidth: 1,
    borderColor: '#bae6fd'
  },
  quotaInfoText: { flex: 1, fontSize: 14, color: '#0369a1', lineHeight: 20, fontWeight: '500' },
  errorButtonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  retryButton: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#315b76',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  skipErrorButton: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  skipErrorButtonPrimary: {
    backgroundColor: '#315b76',
  },
  skipErrorButtonText: { color: '#315b76', fontSize: 15, fontWeight: '600' },
  skipErrorButtonTextPrimary: { color: '#fff' },

  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12
  },
  iconButton: { 
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cachedBadge: { backgroundColor: '#d1fae5', color: '#059669', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1, textAlign: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  
  // Updated Image Styles
  imageContainer: { position: 'relative', marginBottom: 20, borderRadius: 12, overflow: 'hidden' },
  previewImage: { width: '100%', height: 290, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12 },
  zoomIconOverlay: { 
    position: 'absolute', bottom: 10, right: 10, 
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, 
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 
  },
  zoomText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 },

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

  // Metadata Styles (AI Extracted Data)
  metadataSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10 },
  metadataTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  metadataRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  metadataLabel: { fontSize: 12, color: '#475569', fontWeight: '600', minWidth: 110 },
  metadataValue: { fontSize: 12, color: '#1e293b', fontWeight: '500' },
  ratioBar: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  ratioValue: { fontSize: 11, color: '#475569', fontWeight: '700', minWidth: 40, textAlign: 'right' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  totalLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#315b76' },
  confirmButton: { backgroundColor: '#315b76', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, elevation: 2, minWidth: 120, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Modal Styles
  modalBackground: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  zoomScrollContent: { flexGrow: 1, justifyContent: 'center' },
  fullScreenImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height }
});