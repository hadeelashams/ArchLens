import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, Platform, TextInput 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// --- DUMMY DATA ---
const FOUNDATION_TYPES = [
  { id: 'isolated', label: 'Isolated', icon: 'square-outline', desc: 'Single columns' },
  { id: 'strip', label: 'Strip', icon: 'view-agenda-outline', desc: 'Load-bearing walls' },
  { id: 'raft', label: 'Raft / Mat', icon: 'table-large', desc: 'Spread load area' },
  { id: 'pile', label: 'Pile', icon: 'table-column', desc: 'Deep support' },
];

const CATEGORIES = ['Residential', 'Commercial', 'Industrial'];
const CONCRETE_GRADES = ['M20', 'M25', 'M30', 'M35'];
const STEEL_GRADES = ['Fe 500', 'Fe 550', 'Fe 500D'];

export default function FoundationScreen({ navigation }: any) {
  // --- STATE MANAGEMENT ---
  const [totalArea, setTotalArea] = useState('1,250'); // Default dummy value
  const [selectedType, setSelectedType] = useState('isolated');
  const [selectedCategory, setSelectedCategory] = useState('Residential');
  const [concreteGrade, setConcreteGrade] = useState('M25');
  const [steelGrade, setSteelGrade] = useState('Fe 550');

  const handleCalculate = () => {
    // Navigate to next screen or perform calculation
    console.log({ totalArea, selectedType, selectedCategory, concreteGrade, steelGrade });
    navigation.navigate('EstimateResult'); // Assuming this is your next screen
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* --- HEADER --- */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            hitSlop={{top:10, bottom:10, left:10, right:10}}
          >
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Foundation Details</Text>
          <View style={{ width: 40 }} /> {/* Spacer for centering */}
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        >

          {/* --- TOTAL SQUARE FOOTAGE CARD --- */}
          <LinearGradient
            colors={['#315b76', '#4a7c9b']} // Brand Blue Gradient
            style={styles.areaCard}
          >
            <View>
                <Text style={styles.areaLabel}>TOTAL BUILD AREA</Text>
                <View style={styles.areaInputRow}>
                    <TextInput 
                        style={styles.areaInput}
                        value={totalArea}
                        onChangeText={setTotalArea}
                        keyboardType="numeric"
                        selectionColor="#cbd5e1"
                    />
                    <Text style={styles.areaUnit}>sq. ft.</Text>
                </View>
                <Text style={styles.areaSubtext}>Based on your uploaded plan</Text>
            </View>
            <View style={styles.areaIconBg}>
                <MaterialCommunityIcons name="ruler-square" size={32} color="#fff" />
            </View>
          </LinearGradient>

          {/* --- SECTION 1: FOUNDATION TYPE --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FOUNDATION TYPE</Text>
            <View style={styles.gridContainer}>
              {FOUNDATION_TYPES.map((type) => {
                const isActive = selectedType === type.id;
                return (
                  <TouchableOpacity 
                    key={type.id} 
                    style={[styles.typeCard, isActive && styles.typeCardActive]}
                    onPress={() => setSelectedType(type.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.typeIconContainer, isActive && styles.typeIconActive]}>
                        <MaterialCommunityIcons 
                            name={type.icon as any} 
                            size={24} 
                            color={isActive ? '#315b76' : '#94a3b8'} 
                        />
                    </View>
                    <Text style={[styles.typeLabel, isActive && styles.activeText]}>{type.label}</Text>
                    <Text style={styles.typeDesc}>{type.desc}</Text>
                    
                    {isActive && (
                        <View style={styles.checkIcon}>
                            <Ionicons name="checkmark-circle" size={18} color="#315b76" />
                        </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* --- SECTION 2: CATEGORY --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BUILDING CATEGORY</Text>
            <View style={styles.chipRow}>
                {CATEGORIES.map((cat) => {
                    const isActive = selectedCategory === cat;
                    return (
                        <TouchableOpacity 
                            key={cat}
                            style={[styles.chip, isActive && styles.chipActive]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
          </View>

          {/* --- SECTION 3: MATERIAL CONFIG --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MATERIAL SPECIFICATIONS</Text>
            
            <View style={styles.specContainer}>
                {/* Concrete Selector */}
                <View style={styles.specRow}>
                    <View style={styles.specLabelRow}>
                        <MaterialCommunityIcons name="cube-outline" size={20} color="#64748b" />
                        <Text style={styles.specLabel}>Concrete Grade</Text>
                    </View>
                    <View style={styles.toggleGroup}>
                        {CONCRETE_GRADES.map((grade) => (
                            <TouchableOpacity 
                                key={grade}
                                style={[styles.toggleBtn, concreteGrade === grade && styles.toggleBtnActive]}
                                onPress={() => setConcreteGrade(grade)}
                            >
                                <Text style={[styles.toggleText, concreteGrade === grade && styles.toggleTextActive]}>{grade}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                
                <View style={styles.divider} />

                {/* Steel Selector */}
                <View style={styles.specRow}>
                    <View style={styles.specLabelRow}>
                        <MaterialCommunityIcons name="pillar" size={20} color="#64748b" />
                        <Text style={styles.specLabel}>Steel Grade</Text>
                    </View>
                    <View style={styles.toggleGroup}>
                         {STEEL_GRADES.map((grade) => (
                            <TouchableOpacity 
                                key={grade}
                                style={[styles.toggleBtn, steelGrade === grade && styles.toggleBtnActive]}
                                onPress={() => setSteelGrade(grade)}
                            >
                                <Text style={[styles.toggleText, steelGrade === grade && styles.toggleTextActive]}>{grade}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
          </View>

        </ScrollView>

        {/* --- BOTTOM ACTION BUTTON --- */}
        <View style={styles.footer}>
            <TouchableOpacity onPress={handleCalculate} activeOpacity={0.9}>
                <LinearGradient
                    colors={['#1e293b', '#0f172a']}
                    style={styles.calcButton}
                >
                    <Text style={styles.calcButtonText}>Calculate Estimation</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 15 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },

  // Total Area Card
  areaCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 30, shadowColor: '#315b76', shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 },
  areaLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', marginBottom: 5 },
  areaInputRow: { flexDirection: 'row', alignItems: 'baseline' },
  areaInput: { fontSize: 32, fontWeight: '800', color: '#fff', marginRight: 5, padding: 0 },
  areaUnit: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  areaSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  areaIconBg: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  // Sections
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 12 },
  
  // Grid Selection (Foundation Type)
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  typeCard: { width: (width - 60) / 2, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 2, borderColor: '#f1f5f9', position: 'relative' },
  typeCardActive: { borderColor: '#315b76', backgroundColor: '#f0f9ff' },
  typeIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  typeIconActive: { backgroundColor: '#e0f2fe' },
  typeLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  activeText: { color: '#315b76' },
  typeDesc: { fontSize: 11, color: '#64748b' },
  checkIcon: { position: 'absolute', top: 12, right: 12 },

  // Chip Selection (Category)
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 30, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },

  // Material Spec Section
  specContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  specRow: { marginVertical: 8 },
  specLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  specLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  toggleGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  toggleBtnActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' }, // Orange accent for Materials
  toggleText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  toggleTextActive: { color: '#c2410c' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },

  // Footer Button
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: '#F8FAFC' },
  calcButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderRadius: 30, gap: 10, shadowColor: '#0f172a', shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  calcButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});