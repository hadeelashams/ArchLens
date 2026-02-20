import React, { useMemo, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, ActivityIndicator, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { 
  db, 
  WALL_TYPE_SPECS, 
  auth
} from '@archlens/shared';
import { collection, serverTimestamp, addDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const IN_TO_FT = 1 / 12;
const FT_TO_M = 0.3048;           
const CEMENT_BAGS_PER_M3 = 28.8;
const DRY_VOL_MULTIPLIER = 1.33;
const SAND_DENSITY_KG_M3 = 1600;
const CFT_PER_M3 = 35.3147;
const MORTAR_WASTAGE_FACTOR = 1.15;
// ---

export default function WallCostSummaryScreen({ route, navigation }: any) {
  const {
    totalArea = 1000,
    rooms = [],
    projectId,
    tier = 'Standard',
    height = '10.5',
    wallThickness = '9',
    jointThickness = '0.375',
    openingDeduction = '10',
    partitionWallThickness = 4.5,
    avgMainWallRatio = 0.6,
    avgPartitionWallRatio = 0.4,
    avgOpeningPercentage = 10,
    loadBearingBrick = null,
    partitionBrick = null,
    cement = null,
    sand = null,
    aiInsights = null,
    finishPreference = null,
    materialSelectionMode = { loadBearing: 'manual', partition: 'manual' },
    systemCosts = { loadBearing: 0, partition: 0 },
    budgetViolations = { loadBearing: {violated: false, difference: 0}, partition: {violated: false, difference: 0} }
  } = route.params || {};

  const [saving, setSaving] = useState(false);

  // Calculate quantities and costs
  const calculation = useMemo(() => {
    const h_ft = parseFloat(height) || 0;
    const wt_in = parseFloat(wallThickness) || 0;
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const jt_in = parseFloat(jointThickness) || 0;

    if (h_ft <= 0 || wt_in <= 0 || (!loadBearingBrick && !partitionBrick)) {
      return {
        brickQty: 0, cementBags: 0, sandQty: 0, totalCost: 0,
        costBreakdown: { bricks: 0, cement: 0, sand: 0 },
        sandUnit: 'cft',
        loadBearingBrand: 'Not Selected',
        partitionBrand: 'Not Selected',
        cementBrand: 'Not Selected',
        sandBrand: 'Not Selected',
        mortarMix: '1:0',
        layers: 0,
        loadBearingQty: 0,
        partitionQty: 0
      };
    }

    // Calculate material quantity with layer logic
    const calculateType = (brick: any, faceArea_sqft: number, targetWallThick_in: number) => {
      if (!brick || faceArea_sqft <= 0) return { qty: 0, mortarVol_ft3: 0, layers: 0 };

      const dims = brick.dimensions?.toLowerCase().split('x').map((v: string) => parseFloat(v.trim())) || [9, 4, 3];
      const bL_in = dims[0];
      const bW_in = dims[1];
      const bH_in = dims[2];

      const layers = Math.max(1, Math.round(targetWallThick_in / bW_in));

      const bL_ft = (bL_in + jt_in) * IN_TO_FT;
      const bH_ft = (bH_in + jt_in) * IN_TO_FT;
      const brickFaceArea_sqft = bL_ft * bH_ft;

      const baseQty = faceArea_sqft / brickFaceArea_sqft;
      const qty = Math.ceil(baseQty * layers * 1.05);

      const totalWallVol_ft3 = faceArea_sqft * (targetWallThick_in * IN_TO_FT);
      const singleBrickPhysVol_ft3 = (bL_in * bW_in * bH_in) * Math.pow(IN_TO_FT, 3);
      const totalBrickPhysVol_ft3 = qty * singleBrickPhysVol_ft3;

      const mortarVol_ft3 = Math.max(0, totalWallVol_ft3 - totalBrickPhysVol_ft3);

      return { qty, mortarVol_ft3, layers };
    };

    // Calculate running length
    let runningLength_ft = 0;
    if (rooms && rooms.length > 0) {
      runningLength_ft = rooms.reduce((acc: number, r: any) => {
        const roomPerimeter = 2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0));
        return acc + roomPerimeter;
      }, 0);
    } else {
      runningLength_ft = Math.max(200, 4 * Math.sqrt(totalArea || 1000));
    }

    const wallFaceArea_sqft = runningLength_ft * h_ft;
    const netWallFaceArea_sqft = wallFaceArea_sqft * (1 - ded);

    const lbFaceArea_sqft = netWallFaceArea_sqft * avgMainWallRatio;
    const pbFaceArea_sqft = netWallFaceArea_sqft * avgPartitionWallRatio;

    const lbCalc = calculateType(loadBearingBrick, lbFaceArea_sqft, wt_in);
    const pbCalc = calculateType(partitionBrick, pbFaceArea_sqft, partitionWallThickness);

    // Mortar calculations
    const FT3_TO_M3 = Math.pow(FT_TO_M, 3);
    const lbMortarVol_m3 = lbCalc.mortarVol_ft3 * FT3_TO_M3;
    const pbMortarVol_m3 = pbCalc.mortarVol_ft3 * FT3_TO_M3;

    const lbMortarWithWastage_m3 = (lbMortarVol_m3 * MORTAR_WASTAGE_FACTOR);
    const pbMortarWithWastage_m3 = (pbMortarVol_m3 * MORTAR_WASTAGE_FACTOR);

    const lbDryMortar_m3 = lbMortarWithWastage_m3 * DRY_VOL_MULTIPLIER;
    const pbDryMortar_m3 = pbMortarWithWastage_m3 * DRY_VOL_MULTIPLIER;

    const lbMortarSpec = WALL_TYPE_SPECS['Load Bearing'];
    const pbMortarSpec = WALL_TYPE_SPECS['Partition'];

    const lbCementVol = lbDryMortar_m3 * (lbMortarSpec.cementMortar / (lbMortarSpec.cementMortar + lbMortarSpec.sandMortar));
    const lbSandVol = lbDryMortar_m3 * (lbMortarSpec.sandMortar / (lbMortarSpec.cementMortar + lbMortarSpec.sandMortar));

    const pbCementVol = pbDryMortar_m3 * (pbMortarSpec.cementMortar / (pbMortarSpec.cementMortar + pbMortarSpec.sandMortar));
    const pbSandVol = pbDryMortar_m3 * (pbMortarSpec.sandMortar / (pbMortarSpec.cementMortar + pbMortarSpec.sandMortar));

    const totalCementVol_m3 = lbCementVol + pbCementVol;
    const totalSandVol_m3 = lbSandVol + pbSandVol;

    const cementBags = Math.ceil(totalCementVol_m3 * CEMENT_BAGS_PER_M3);
    const mortarRatio = totalCementVol_m3 > 0 ? (totalSandVol_m3 / totalCementVol_m3).toFixed(1) : '0';

    const sandUnit = sand?.unit?.toLowerCase() || 'cft';
    let finalSandQty: number;
    let sandUnitDisplay: string;

    if (sandUnit.includes('cft') || sandUnit.includes('cubic')) {
      finalSandQty = totalSandVol_m3 * CFT_PER_M3;
      sandUnitDisplay = 'cft';
    } else if (sandUnit.includes('ton') || sandUnit.includes('tonne')) {
      finalSandQty = (totalSandVol_m3 * SAND_DENSITY_KG_M3) / 1000;
      sandUnitDisplay = 'Ton';
    } else if (sandUnit.includes('kg')) {
      finalSandQty = totalSandVol_m3 * SAND_DENSITY_KG_M3;
      sandUnitDisplay = 'kg';
    } else {
      finalSandQty = totalSandVol_m3 * CFT_PER_M3;
      sandUnitDisplay = 'cft';
    }
    finalSandQty = parseFloat(finalSandQty.toFixed(2));

    // Cost calculation
    const lbPrice = parseFloat(loadBearingBrick?.pricePerUnit || 0);
    const pbPrice = parseFloat(partitionBrick?.pricePerUnit || 0);
    const cPrice = parseFloat(cement?.pricePerUnit || 0);
    const sPrice = parseFloat(sand?.pricePerUnit || 0);

    const lbCost = Math.round(lbPrice * lbCalc.qty);
    const pbCost = Math.round(pbPrice * pbCalc.qty);
    const cCost = Math.round(cPrice * cementBags);

    let sCost = 0;
    if (sandUnit.includes('ton')) {
      const sandQtyInTon = (totalSandVol_m3 * SAND_DENSITY_KG_M3) / 1000;
      sCost = Math.round(sandQtyInTon * sPrice);
    } else {
      sCost = Math.round(finalSandQty * sPrice);
    }

    return {
      brickQty: lbCalc.qty + pbCalc.qty,
      loadBearingQty: lbCalc.qty,
      partitionQty: pbCalc.qty,
      cementBags,
      sandQty: finalSandQty,
      sandUnit: sandUnitDisplay,
      loadBearingBrand: loadBearingBrick?.name || 'Not Selected',
      partitionBrand: partitionBrick?.name || 'Not Selected',
      cementBrand: cement?.name || 'Not Selected',
      sandBrand: sand?.name || 'Not Selected',
      mortarMix: `1:${mortarRatio}`,
      totalCost: Math.round(lbCost + pbCost + cCost + sCost),
      costBreakdown: { bricks: lbCost + pbCost, cement: cCost, sand: sCost },
      layers: `LB: ${lbCalc.layers} layers, PB: ${pbCalc.layers} layers`
    };
  }, [height, wallThickness, jointThickness, openingDeduction, loadBearingBrick, partitionBrick, cement, sand, totalArea, rooms, avgMainWallRatio, avgPartitionWallRatio, partitionWallThickness]);

  const handleSaveWallEstimate = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "User not authenticated.");
    if (!projectId) return Alert.alert("Error", "Project ID not found.");

    const h_ft = parseFloat(height) || 0;
    const wt_in = parseFloat(wallThickness) || 0;

    if (h_ft <= 0) return Alert.alert("Validation Error", "Please enter a valid height.");
    if (wt_in <= 0) return Alert.alert("Validation Error", "Please enter a valid wall thickness.");
    if (!loadBearingBrick && !partitionBrick) return Alert.alert("Validation Error", "Please select at least one material type.");
    if (calculation.totalCost === 0) return Alert.alert("Error", "Cost calculation failed. Check dimensions and material selections.");

    setSaving(true);
    try {
      const lineItems = [];

      if (calculation.loadBearingQty > 0) {
        lineItems.push({
          name: calculation.loadBearingBrand || 'Not Selected',
          desc: 'Load-Bearing Bricks/Blocks',
          qty: calculation.loadBearingQty,
          unit: 'Nos',
          total: Math.round((calculation.costBreakdown.bricks * (calculation.loadBearingQty / calculation.brickQty)) || 0),
          rate: loadBearingBrick?.pricePerUnit || 0
        });
      }

      if (calculation.partitionQty > 0) {
        lineItems.push({
          name: calculation.partitionBrand || 'Not Selected',
          desc: 'Partition Bricks/Blocks',
          qty: calculation.partitionQty,
          unit: 'Nos',
          total: Math.round((calculation.costBreakdown.bricks * (calculation.partitionQty / calculation.brickQty)) || 0),
          rate: partitionBrick?.pricePerUnit || 0
        });
      }

      lineItems.push({
        name: calculation.cementBrand || 'Not Selected',
        desc: `Mortar Cement (Mix ${calculation.mortarMix})`,
        qty: calculation.cementBags,
        unit: 'Bags',
        total: calculation.costBreakdown.cement,
        rate: cement?.pricePerUnit || 0
      });

      lineItems.push({
        name: calculation.sandBrand || 'Not Selected',
        desc: `Mortar Sand (Mix ${calculation.mortarMix})`,
        qty: calculation.sandQty,
        unit: calculation.sandUnit || 'cft',
        total: calculation.costBreakdown.sand,
        rate: sand?.pricePerUnit || 0
      });

      const estimateData = {
        projectId: projectId || '',
        userId: auth.currentUser!.uid,
        itemName: `Wall Masonry (Load-Bearing & Partition)`,
        category: 'Wall',
        totalCost: calculation.totalCost || 0,
        lineItems: lineItems.filter(item => item.name !== undefined),
        specifications: {
          wallComposition: `${(avgMainWallRatio * 100).toFixed(0)}% Load-Bearing, ${(avgPartitionWallRatio * 100).toFixed(0)}% Partition`,
          height: `${height} ft`,
          thickness: `${wallThickness} in`,
          jointThickness: `${jointThickness} in`,
          deduction: `${openingDeduction}%`,
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'estimates'), estimateData);

      const detectedWallComposition = {
        loadBearingPercentage: (avgMainWallRatio * 100).toFixed(0),
        partitionPercentage: (avgPartitionWallRatio * 100).toFixed(0),
        openingPercentage: avgOpeningPercentage,
        averageWallThickness: parseFloat(wallThickness) || 0,
        confidence: 0.95
      };

      Alert.alert("Success", "Wall Estimate saved successfully.");
      navigation.navigate('ProjectSummary', { projectId, wallComposition: detectedWallComposition });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>Material Cost</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>{tier || 'Standard'}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Summary Card - Dark Theme */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryLabel}>TOTAL MATERIAL COST</Text>
                <Text style={styles.summaryTotal}>₹{calculation.totalCost.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.methodBadge}>
                <Text style={styles.methodBadgeText}>Wall Masonry</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.specRow}>
              <View style={styles.specItem}>
                <Ionicons name="arrow-up-outline" size={14} color="#cbd5e1" />
                <Text style={styles.specText}>{height} ft Height</Text>
              </View>
              <View style={styles.specItem}>
                <Ionicons name="resize-outline" size={14} color="#cbd5e1" />
                <Text style={styles.specText}>{wallThickness}" Thick</Text>
              </View>
              <View style={styles.specItem}>
                <Ionicons name="flask-outline" size={14} color="#cbd5e1" />
                <Text style={styles.specText}>{calculation.mortarMix} Mix</Text>
              </View>
            </View>
          </View>

          {/* Material Breakdown Table */}
          <Text style={styles.sectionTitle}>MATERIAL BREAKDOWN</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, {flex: 2}]}>Material</Text>
              <Text style={[styles.th, {flex: 1, textAlign: 'center'}]}>Qty</Text>
              <Text style={[styles.th, {flex: 1.2, textAlign: 'right'}]}>Cost</Text>
            </View>

            {/* Load-Bearing Bricks */}
            {calculation.loadBearingQty > 0 && (
              <View style={styles.tableRow}>
                <View style={{flex: 2}}>
                  <Text style={styles.categoryLabel}>Load-Bearing</Text>
                  <Text style={styles.itemName}>{calculation.loadBearingBrand}</Text>
                  <Text style={styles.itemDesc}>Main Wall Masonry</Text>
                </View>
                <View style={{flex: 1, alignItems: 'center'}}>
                  <Text style={styles.itemQty}>{calculation.loadBearingQty} <Text style={styles.itemUnit}>Nos</Text></Text>
                </View>
                <View style={{flex: 1.2, alignItems: 'flex-end'}}>
                  <Text style={styles.itemPrice}>₹{Math.round((calculation.costBreakdown.bricks * (calculation.loadBearingQty / calculation.brickQty)) || 0).toLocaleString()}</Text>
                  <Text style={styles.itemRate}>@ ₹{loadBearingBrick?.pricePerUnit || 0}/Nos</Text>
                </View>
              </View>
            )}

            {/* Partition Bricks */}
            {calculation.partitionQty > 0 && (
              <View style={styles.tableRow}>
                <View style={{flex: 2}}>
                  <Text style={styles.categoryLabel}>Partition</Text>
                  <Text style={styles.itemName}>{calculation.partitionBrand}</Text>
                  <Text style={styles.itemDesc}>{partitionWallThickness.toFixed(1)}" Partition Wall</Text>
                </View>
                <View style={{flex: 1, alignItems: 'center'}}>
                  <Text style={styles.itemQty}>{calculation.partitionQty} <Text style={styles.itemUnit}>Nos</Text></Text>
                </View>
                <View style={{flex: 1.2, alignItems: 'flex-end'}}>
                  <Text style={styles.itemPrice}>₹{Math.round((calculation.costBreakdown.bricks * (calculation.partitionQty / calculation.brickQty)) || 0).toLocaleString()}</Text>
                  <Text style={styles.itemRate}>@ ₹{partitionBrick?.pricePerUnit || 0}/Nos</Text>
                </View>
              </View>
            )}

            {/* Cement */}
            <View style={styles.tableRow}>
              <View style={{flex: 2}}>
                <Text style={styles.categoryLabel}>Mortar</Text>
                <Text style={styles.itemName}>{calculation.cementBrand}</Text>
                <Text style={styles.itemDesc}>Cement {calculation.mortarMix}</Text>
              </View>
              <View style={{flex: 1, alignItems: 'center'}}>
                <Text style={styles.itemQty}>{calculation.cementBags} <Text style={styles.itemUnit}>Bags</Text></Text>
              </View>
              <View style={{flex: 1.2, alignItems: 'flex-end'}}>
                <Text style={styles.itemPrice}>₹{calculation.costBreakdown.cement.toLocaleString()}</Text>
                <Text style={styles.itemRate}>@ ₹{cement?.pricePerUnit || 0}/Bag</Text>
              </View>
            </View>

            {/* Sand */}
            <View style={styles.tableRow}>
              <View style={{flex: 2}}>
                <Text style={styles.categoryLabel}>Mortar</Text>
                <Text style={styles.itemName}>{calculation.sandBrand}</Text>
                <Text style={styles.itemDesc}>Mortar Sand {calculation.mortarMix}</Text>
              </View>
              <View style={{flex: 1, alignItems: 'center'}}>
                <Text style={styles.itemQty}>{calculation.sandQty} <Text style={styles.itemUnit}>{calculation.sandUnit}</Text></Text>
              </View>
              <View style={{flex: 1.2, alignItems: 'flex-end'}}>
                <Text style={styles.itemPrice}>₹{calculation.costBreakdown.sand.toLocaleString()}</Text>
                <Text style={styles.itemRate}>@ ₹{sand?.pricePerUnit || 0}/{calculation.sandUnit}</Text>
              </View>
            </View>
          </View>

          {/* AI Engineering Insight Badge - For all tiers */}
          {aiInsights && (
            <View style={styles.aiInsightContainer}>
              <View style={styles.aiInsightBadge}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 10}}>
                  <View style={styles.aiInsightIconBox}>
                    <Ionicons name="bulb-outline" size={18} color="#fff" />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.aiInsightTitle}>✨ AI Material Recommendation</Text>
                    {aiInsights.costSavingsPercent > 0 && (
                      <Text style={styles.aiInsightSavings}>
                        💰 Saves ~{aiInsights.costSavingsPercent}% vs standard spec
                      </Text>
                    )}
                    <Text style={styles.aiInsightReason}>{aiInsights.reason}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.disclaimerText}>
              Calculations include 15% mortar wastage factor & real perimeter measurement. 2026 market rates applied.
            </Text>
          </View>

          <View style={{height: 100}} />
        </ScrollView>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSaveWallEstimate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.saveBtnText}>Save Material Estimate</Text>
              <Ionicons name="save-outline" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  safeArea: { 
    flex: 1 
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 20 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1e293b' 
  },
  roundBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#fff', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 2 
  },
  tierBadge: { 
    backgroundColor: '#315b76', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10 
  },
  tierText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '800' 
  },
  
  // Scroll Content
  scroll: { 
    padding: 20 
  },
  
  // Summary Card - Dark Theme
  summaryCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 24, 
    padding: 25, 
    marginBottom: 25, 
    elevation: 8 
  },
  summaryHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  summaryLabel: { 
    color: '#94a3b8', 
    fontSize: 11, 
    fontWeight: '700', 
    letterSpacing: 1, 
    marginBottom: 5,
    textTransform: 'uppercase'
  },
  summaryTotal: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: '800' 
  },
  methodBadge: { 
    backgroundColor: '#315b76', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8 
  },
  methodBadgeText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700' 
  },
  divider: { 
    height: 1, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    marginVertical: 15 
  },
  specRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  specItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  specText: { 
    color: '#cbd5e1', 
    fontSize: 13, 
    fontWeight: '500' 
  },
  
  // Section Title
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: '#64748b', 
    marginBottom: 15, 
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  
  // Table Layout
  table: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  tableHeader: { 
    flexDirection: 'row', 
    backgroundColor: '#f1f5f9', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0' 
  },
  th: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#64748b', 
    textTransform: 'uppercase' 
  },
  tableRow: { 
    flexDirection: 'row', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9', 
    alignItems: 'center' 
  },
  categoryLabel: { 
    fontSize: 9, 
    fontWeight: '800', 
    color: '#315b76', 
    textTransform: 'uppercase', 
    marginBottom: 2 
  },
  itemName: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#334155' 
  },
  itemDesc: { 
    fontSize: 11, 
    color: '#94a3b8', 
    marginTop: 1 
  },
  itemQty: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#1e293b' 
  },
  itemUnit: { 
    fontSize: 10, 
    color: '#94a3b8', 
    fontWeight: '500' 
  },
  itemPrice: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#10b981' 
  },
  itemRate: { 
    fontSize: 10, 
    color: '#94a3b8', 
    marginTop: 1 
  },
  
  // AI Insight Badge
  aiInsightContainer: {
    marginTop: 20
  },
  aiInsightBadge: { 
    backgroundColor: '#f0fdf4', 
    borderWidth: 1.5, 
    borderColor: '#bbf7d0', 
    borderRadius: 16, 
    padding: 16,
    overflow: 'hidden'
  },
  aiInsightIconBox: { 
    width: 40, 
    height: 40, 
    backgroundColor: '#16a34a', 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  aiInsightTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#15803d', 
    marginBottom: 6 
  },
  aiInsightSavings: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#10b981', 
    marginBottom: 4 
  },
  aiInsightReason: { 
    fontSize: 11, 
    color: '#22c55e', 
    fontWeight: '500', 
    lineHeight: 16 
  },
  
  // Disclaimer Box
  disclaimer: { 
    flexDirection: 'row', 
    gap: 10, 
    backgroundColor: '#E0F2FE', 
    padding: 15, 
    borderRadius: 16, 
    marginTop: 20, 
    borderWidth: 1, 
    borderColor: '#BAE6FD' 
  },
  disclaimerText: { 
    flex: 1, 
    fontSize: 11, 
    color: '#0369a1', 
    lineHeight: 16 
  },
  
  // Save Button
  saveBtn: { 
    position: 'absolute', 
    bottom: 30, 
    alignSelf: 'center', 
    width: width * 0.85, 
    backgroundColor: '#315b76', 
    padding: 18, 
    borderRadius: 20, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 10, 
    elevation: 5 
  },
  saveBtnDisabled: {
    opacity: 0.6
  },
  saveBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  }
});
