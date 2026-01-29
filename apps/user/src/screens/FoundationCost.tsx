import React, { useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { createEstimate } from '../services/projectService';
import { auth } from '@archlens/shared';

const { width } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const FT_TO_M = 0.3048;           
const DRY_MIX_FACTOR = 1.54;      
const STEEL_DENSITY_KG_M3 = 80;   
const WORKSPACE_OFFSET_M = 0.3;   // 1ft extra space around footing for labor

export default function FoundationCost({ route, navigation }: any) {
  const { 
    projectId, 
    area, 
    activeMethod,
    selections,
    numFootings,
    lengthFt,
    widthFt,
    depthFt,
    pccThicknessFt
  } = route.params;

  const calculation = useMemo(() => {
    // 1. CONVERT INPUTS TO METRIC
    const n = parseInt(numFootings) || 0;
    const lm = parseFloat(lengthFt) * FT_TO_M;
    const wm = parseFloat(widthFt) * FT_TO_M;
    const dm = parseFloat(depthFt) * FT_TO_M;
    const pccTm = parseFloat(pccThicknessFt) * FT_TO_M;
    const rccHm = 0.45; // Standard 1.5ft footing pad height

    // 2. VOLUME CALCULATIONS
    // Excavation (Area + offset)
    const volExcavation = n * (lm + WORKSPACE_OFFSET_M * 2) * (wm + WORKSPACE_OFFSET_M * 2) * dm;
    
    // PCC Volume
    const volPcc = n * lm * wm * pccTm;
    
    // RCC Volume (The footing pad)
    const volRcc = n * lm * wm * rccHm;

    // 3. MATERIAL QUANTITIES (Based on Standard Coefficients)
    const cementBags = (volRcc * 8.07) + (volPcc * 4.4);
    const steelKg = volRcc * STEEL_DENSITY_KG_M3;
    const sandM3 = (volRcc * 0.425) + (volPcc * 0.45);
    const aggregateM3 = (volRcc * 0.85) + (volPcc * 0.90);

    // 4. BOQ ITEMS GENERATION
    const items = [
      {
        name: "Earthwork Excavation",
        formula: `${n} Nos × ${(lm + 0.6).toFixed(1)}m × ${(wm + 0.6).toFixed(1)}m × ${dm.toFixed(1)}m`,
        qty: volExcavation.toFixed(2),
        unit: "m³",
        rate: 450, 
        total: volExcavation * 450,
        brand: "Manual/Excavator"
      },
      {
        name: "Cement (Foundation)",
        formula: `RCC: ${volRcc.toFixed(1)}m³ + PCC: ${volPcc.toFixed(1)}m³`,
        qty: Math.ceil(cementBags).toString(),
        unit: "Bags",
        rate: selections['Cement']?.pricePerUnit || 450,
        total: Math.ceil(cementBags) * (selections['Cement']?.pricePerUnit || 450),
        brand: selections['Cement']?.name || "Selected Brand"
      },
      {
        name: "Steel (Footing Mesh)",
        formula: `Vol_RCC × ${STEEL_DENSITY_KG_M3}kg/m³`,
        qty: steelKg.toFixed(0),
        unit: "kg",
        rate: selections['Steel (TMT Bar)']?.pricePerUnit || 72,
        total: steelKg * (selections['Steel (TMT Bar)']?.pricePerUnit || 72),
        brand: selections['Steel (TMT Bar)']?.name || "TMT Fe500D"
      },
      {
        name: "Crushed Aggregate",
        formula: `RCC @ 0.85 + PCC @ 0.90`,
        qty: aggregateM3.toFixed(2),
        unit: "m³",
        rate: 1200,
        total: aggregateM3 * 1200,
        brand: "20mm Blue Metal"
      },
      {
        name: "Fine Sand / M-Sand",
        formula: `RCC @ 0.425 + PCC @ 0.45`,
        qty: sandM3.toFixed(2),
        unit: "m³",
        rate: 1350,
        total: sandM3 * 1350,
        brand: "Concrete Sand"
      }
    ];

    const grandTotal = items.reduce((acc, curr) => acc + curr.total, 0);

    return { items, grandTotal, totalConc: (volRcc + volPcc).toFixed(2) };
  }, [numFootings, lengthFt, widthFt, depthFt, pccThicknessFt, selections]);


  
  const handleConfirmAndSave = async () => {
    if(!auth.currentUser) return;
    
    try {
        await createEstimate({
            projectId: projectId,
            userId: auth.currentUser.uid,
            category: 'Foundation',
            itemName: `${activeMethod} Foundation`,
            quantity: 1,
            unit: 'Lot',
            unitCost: calculation.grandTotal,
            totalCost: calculation.grandTotal,
            notes: `${numFootings} Footings (${depthFt}ft depth)`
        });

        // Navigate to the new Cart/Summary Screen
        navigation.navigate('ProjectSummary', { projectId });
        
    } catch (e: any) {
        alert("Error saving: " + e.message);
    }
  };


  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Foundation Cost</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* Summary Context Card */}
          <View style={styles.summaryCard}>
            <View style={styles.aiHeader}>
              <Ionicons name="construct" size={18} color="#fff" />
              <Text style={styles.aiTitle}>STRUCTURAL SUMMARY</Text>
            </View>
            <Text style={styles.areaDisplay}>{area} <Text style={{fontSize: 14, fontWeight: '400'}}>sq.ft Total Area</Text></Text>
            <Text style={styles.summaryDetail}>Method: {activeMethod} Foundation</Text>
            <Text style={styles.summaryDetail}>Geometry: {numFootings} Footings ({lengthFt}'x{widthFt}')</Text>
            
            <View style={styles.tagRow}>
              <View style={styles.tag}><Text style={styles.tagText}>Concrete: {calculation.totalConc}m³</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>Excavation: {depthFt}ft Depth</Text></View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>DETAILED BREAKDOWN</Text>

          {/* BOQ Table */}
          <View style={styles.boqTable}>
            {calculation.items.map((item, idx) => (
              <View key={idx} style={styles.boqRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemFormula}>{item.formula}</Text>
                  <Text style={styles.itemBrand}>{item.brand}</Text>
                </View>
                <View style={styles.itemQtyCol}>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <Text style={styles.unitText}>{item.unit}</Text>
                </View>
                <View style={styles.itemCostCol}>
                  <Text style={styles.costText}>₹{Math.round(item.total).toLocaleString()}</Text>
                </View>
              </View>
            ))}

            {/* Grand Total */}
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Estimated Total</Text>
                <Text style={styles.taxNote}>*Includes Material & Labor</Text>
              </View>
              <Text style={styles.totalValue}>₹{Math.round(calculation.grandTotal).toLocaleString()}</Text>
            </View>
          </View>

          {/* Standards Note */}
          <View style={styles.noteBox}>
            <Ionicons name="information-circle" size={16} color="#315b76" />
            <Text style={styles.noteText}>
              Quantities derived using IS 456 coefficients. Excavation includes a 300mm offset for formwork and labor movement.
            </Text>
          </View>

          <View style={{height: 100}} />
        </ScrollView>

        <TouchableOpacity 
          style={styles.mainBtn}
          onPress={() => navigation.navigate('EstimateResult', { projectId, boq: calculation })}
        >
          <Text style={styles.mainBtnText}>Confirm & Save Estimate</Text>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  scroll: { padding: 20 },

  summaryCard: { backgroundColor: '#315b76', padding: 20, borderRadius: 24, marginBottom: 25, elevation: 4 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  aiTitle: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  summaryDetail: { color: '#E0F2FE', fontSize: 14, marginBottom: 4, fontWeight: '500' },
  tagRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  tag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
  
  areaDisplay: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 10 },

  boqTable: { backgroundColor: '#fff', borderRadius: 24, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  boqRow: { flexDirection: 'row', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginHorizontal: 12 },
  itemInfo: { flex: 2 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  itemFormula: { fontSize: 10, color: '#315b76', marginVertical: 4, fontWeight: '600' },
  itemBrand: { fontSize: 11, color: '#64748b' },
  itemQtyCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  unitText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  itemCostCol: { flex: 1.2, alignItems: 'flex-end', justifyContent: 'center' },
  costText: { fontSize: 16, fontWeight: '800', color: '#10b981' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#F0F9FF', borderRadius: 18, marginTop: 8 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#315b76' },
  taxNote: { fontSize: 10, color: '#94a3b8' },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#1e293b' },

  noteBox: { flexDirection: 'row', padding: 16, backgroundColor: '#F1F5F9', borderRadius: 16, marginTop: 20, gap: 10, alignItems: 'center' },
  noteText: { flex: 1, fontSize: 11, color: '#64748b', lineHeight: 16, fontWeight: '500' },

  mainBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#315b76', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 6 },
  mainBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});