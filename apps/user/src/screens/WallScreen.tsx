import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, TextInput, Image, ActivityIndicator,
  Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallCalculations } from '../hooks/useWallCalculations';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WallScreen({ route, navigation }: any) {
  const { totalArea = 1000, rooms = [], projectId, tier = 'Standard', wallComposition } = route.params || {};

  //  All business logic lives in the hook 
  const {
    loading, materials, selections, setSelections,
    loadBearingBrick, setLoadBearingBrickManual,
    partitionBrick,   setPartitionBrickManual,
    height, setHeight,
    wallThickness, setWallThickness,
    jointThickness, setJointThickness,
    openingDeduction, setOpeningDeduction,
    partitionWallThickness,
    avgOpeningPercentage, avgMainWallRatio, avgPartitionWallRatio,
    isDetectingComposition,
    finishPreference, setFinishPreference,
    aiPerspectives, selectedPerspectiveId,
    isPerspectiveLoading, loadAIPerspectives, applyPerspective,
    materialSelectionMode,
    calculation, systemCosts, budgetViolations,
  } = useWallCalculations({ totalArea, rooms, tier, wallComposition });

  //  Pure UI state (never drives calculations) 
  const [wallThicknessError,      setWallThicknessError]      = useState<string | null>(null);
  const [cementDropdownOpen,      setCementDropdownOpen]      = useState(false);
  const [sandDropdownOpen,        setSandDropdownOpen]        = useState(false);
  const [loadBearingMaterialType, setLoadBearingMaterialType] = useState('All');
  const [partitionMaterialType,   setPartitionMaterialType]   = useState('All');


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#315b76" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/*  Header  */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tier} Wall Setup</Text>
          <View style={styles.tierBadge}><Text style={styles.tierText}>{tier}</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/*  Wall Composition Card  */}
          <View style={[styles.metadataInfoCard, isDetectingComposition && { opacity: 0.8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.metadataInfoTitle}> Wall Composition</Text>
              {rooms?.length > 0 && (
                <View style={{ marginLeft: 8, backgroundColor: '#315b76', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>From Rooms</Text>
                </View>
              )}
            </View>
            <View style={styles.metadataInfoRow}>
              {[
                { label: 'Load-Bearing', value: `${(avgMainWallRatio * 100).toFixed(0)}%`, color: '#ef4444' },
                { label: 'Partition',    value: `${(avgPartitionWallRatio * 100).toFixed(0)}%`, color: '#3b82f6' },
                { label: 'Openings',     value: `${avgOpeningPercentage}%`, color: '#f59e0b' },
              ].map(({ label, value, color }) => (
                <View key={label} style={styles.metadataInfoItem}>
                  <Text style={styles.metadataInfoLabel}>{label}</Text>
                  <Text style={styles.metadataInfoValue}>{value}</Text>
                  <View style={{ height: 4, backgroundColor: color, borderRadius: 2, marginTop: 4, width: '100%' }} />
                </View>
              ))}
            </View>
          </View>

          {/*  AI Generated Options  */}
          <View style={styles.perspectivesSection}>
            <View style={styles.perspectivesHeader}>
              <Text style={styles.sectionLabel}>AI GENERATED OPTIONS</Text>
              <TouchableOpacity
                style={[styles.regenerateBtn, isPerspectiveLoading && { opacity: 0.6 }]}
                onPress={loadAIPerspectives}
                disabled={isPerspectiveLoading}
              >
                {isPerspectiveLoading
                  ? <ActivityIndicator size="small" color="#315b76" />
                  : <><Ionicons name="refresh" size={12} color="#315b76" /><Text style={styles.regenerateBtnText}>Refresh</Text></>
                }
              </TouchableOpacity>
            </View>

            {isPerspectiveLoading ? (
              <View style={styles.perspectiveLoadingCard}>
                <ActivityIndicator size="large" color="#315b76" />
                <Text style={styles.perspectiveLoadingText}>AI is generating {tier} options for your wall</Text>
              </View>
            ) : aiPerspectives.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                {aiPerspectives.map((p) => {
                  const isSelected = selectedPerspectiveId === p.id;
                  const lbMat = materials.find(m => m.id === p.loadBearingBrickId);
                  const pbMat = materials.find(m => m.id === p.partitionBrickId);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.perspectiveCard, styles.perspectiveCardHorizontal, isSelected && styles.perspectiveCardSelected]}
                      onPress={() => applyPerspective(p)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.perspectiveCardHeader}>
                        <View style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
                          <Text style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextSelected]}>Option {p.id}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.perspectiveTitle, isSelected && { color: '#315b76' }]}>{p.title}</Text>
                          <Text style={styles.perspectiveSubtitle}>{p.subtitle}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? '#315b76' : '#cbd5e1'}
                        />
                      </View>
                      <View style={styles.perspectiveFocusRow}>
                        <Ionicons name="flash-outline" size={11} color="#94a3b8" />
                        <Text style={styles.perspectiveFocusText} numberOfLines={2}>
                          {p.description
                            .replace(/^(this option|this approach|this perspective|this choice|this selection|this combination|this design)[,:]?\s*/i, '')
                            .replace(/^[a-z]/, c => c.toUpperCase())}
                        </Text>
                      </View>
                      <View style={styles.perspectiveMaterials}>
                        {lbMat && <Text style={styles.perspectiveMaterialItem}>Load-Bearing: {lbMat.name}  ₹{lbMat.pricePerUnit}/{lbMat.unit}</Text>}
                        {pbMat && <Text style={styles.perspectiveMaterialItem}>Partition: {pbMat.name}  ₹{pbMat.pricePerUnit}/{pbMat.unit}</Text>}
                      </View>
                      <View style={styles.perspectiveTags}>
                        {p.tags.map(tag => (
                          <View key={tag} style={styles.perspectiveTagChip}>
                            <Text style={styles.perspectiveTagText}>{tag}</Text>
                          </View>
                        ))}
                        <View style={[styles.perspectiveTagChip, {
                          backgroundColor: p.finishType === 'Exposed' ? '#f0fdf4' : '#eff6ff',
                          borderColor:     p.finishType === 'Exposed' ? '#86efac' : '#bfdbfe',
                        }]}>
                          <Text style={[styles.perspectiveTagText,
                            { color: p.finishType === 'Exposed' ? '#15803d' : '#2563eb' }]}>
                            {p.finishType} Finish
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <TouchableOpacity style={styles.loadPerspectivesBtn} onPress={loadAIPerspectives}>
                <Ionicons name="sparkles" size={16} color="#315b76" />
                <Text style={styles.loadPerspectivesBtnText}>Generate AI Options</Text>
              </TouchableOpacity>
            )}
          </View>

          {/*  Dimensions & Deductions  */}
          <View style={styles.inputCard}>
            <Text style={styles.sectionLabel}>DIMENSIONS & DEDUCTIONS</Text>
            <View style={styles.row}>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Height (ft)</Text>
                <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Wall Thickness (in)*</Text>
                <TextInput
                  style={[styles.input, wallThicknessError && { borderColor: '#ef4444' }]}
                  value={wallThickness}
                  onChangeText={setWallThickness}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 9"
                />
              </View>
            </View>
            {wallThicknessError && <Text style={styles.inputErrorText}>{wallThicknessError}</Text>}
            <View style={[styles.row, { marginTop: 10 }]}>
              <View style={styles.inputBox}>
                <Text style={[styles.label, { color: '#ef4444' }]}>Openings %</Text>
                <TextInput style={[styles.input, { borderColor: '#fee2e2' }]} value={openingDeduction} onChangeText={setOpeningDeduction} keyboardType="numeric" />
              </View>
              <View style={styles.inputBox}>
                <Text style={[styles.label, { color: '#315b76' }]}>Joint Thickness (in)</Text>
                <TextInput style={[styles.input, { borderColor: '#d1e0f0' }]} value={jointThickness} onChangeText={setJointThickness} keyboardType="decimal-pad" />
              </View>
            </View>
          </View>

          {/*  Wall Materials header  */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionLabel}>WALL MATERIALS</Text>
            {selectedPerspectiveId ? (
              <View style={styles.aiAppliedBadge}>
                <Ionicons name="sparkles" size={11} color="#315b76" />
                <Text style={styles.aiAppliedBadgeText}>Option {selectedPerspectiveId} Applied</Text>
              </View>
            ) : (
              <View style={styles.customBadge}>
                <Ionicons name="hand-left-outline" size={11} color="#64748b" />
                <Text style={styles.customBadgeText}>Custom Selection</Text>
              </View>
            )}
          </View>

          {/*  Load-Bearing Material Card  */}
          <View style={styles.materialCard}>
            <View style={styles.materialCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.materialLabel}>Load-Bearing Walls</Text>
                <Text style={styles.materialSubLabel}>{(avgMainWallRatio * 100).toFixed(0)}% of structure</Text>
              </View>
              <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>9 inch</Text>
              </View>
            </View>

            {/* Filter chips */}
            <View style={styles.materialTypeContainer}>
              {['All', 'Brick Wall', 'Block Wall', 'Stone Wall'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, loadBearingMaterialType === type && styles.typeChipActive]}
                  onPress={() => setLoadBearingMaterialType(type)}
                >
                  <Text style={[styles.typeChipText, loadBearingMaterialType === type && styles.typeChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Horizontal scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.brandScroll, { marginVertical: 10 }]}>
              {(() => {
                let list = materials.filter(m =>
                  m.category === 'Wall' &&
                  (m.subCategory === 'Load Bearing' || m.subCategory === 'LoadBearing' || m.subCategory === 'load-bearing' || m.subCategory === 'load bearing')
                );
                if (list.length === 0) list = materials.filter(m => m.category === 'Wall');
                if (loadBearingMaterialType !== 'All') list = list.filter(m => m.type === loadBearingMaterialType);
                return list.length > 0
                  ? list.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.brandCard, styles.materialBrandCard, loadBearingBrick?.id === item.id && styles.activeBrand]}
                      onPress={() => setLoadBearingBrickManual(item)}
                    >
                      <View style={styles.imagePlaceholder}>
                        {item.imageUrl
                          ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} />
                          : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                      </View>
                      <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                      <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
                    </TouchableOpacity>
                  ))
                  : <Text style={styles.emptyText}>No materials found.</Text>;
              })()}
            </ScrollView>
            {loadBearingBrick && <Text style={styles.materialQty}>{calculation.loadBearingQty} units needed</Text>}
          </View>

          {/*  Partition Material Card  */}
          <View style={[styles.materialCard, { marginTop: 12 }]}>
            <View style={styles.materialCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.materialLabel}>Partition Walls</Text>
                <Text style={styles.materialSubLabel}>{(avgPartitionWallRatio * 100).toFixed(0)}% of structure</Text>
              </View>
              <View style={{ backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{partitionWallThickness.toFixed(1)} inch</Text>
              </View>
            </View>

            {/* Filter chips */}
            <View style={styles.materialTypeContainer}>
              {['All', 'Brick Partition', 'Block Partition', 'Dry Wall', 'Glass', 'Wood Wall'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, partitionMaterialType === type && styles.typeChipActive]}
                  onPress={() => setPartitionMaterialType(type)}
                >
                  <Text style={[styles.typeChipText, partitionMaterialType === type && styles.typeChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Horizontal scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.brandScroll, { marginVertical: 10 }]}>
              {(() => {
                let list = materials.filter(m =>
                  m.category === 'Wall' &&
                  ['Partition Wall', 'Partition', 'Non-Load Bearing', 'partition', 'partition wall', 'non-load bearing'].includes(
                    m.subCategory?.toLowerCase?.() ?? m.subCategory
                  )
                );
                if (list.length === 0) list = materials.filter(m => m.category === 'Wall');
                if (partitionMaterialType !== 'All') list = list.filter(m => m.type === partitionMaterialType);
                return list.length > 0
                  ? list.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.brandCard, styles.materialBrandCard, partitionBrick?.id === item.id && styles.activeBrand]}
                      onPress={() => setPartitionBrickManual(item)}
                    >
                      <View style={styles.imagePlaceholder}>
                        {item.imageUrl
                          ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} />
                          : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                      </View>
                      <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                      <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
                    </TouchableOpacity>
                  ))
                  : <Text style={styles.emptyText}>No materials found.</Text>;
              })()}
            </ScrollView>
            {partitionBrick && <Text style={styles.materialQty}>{calculation.partitionQty} units needed</Text>}
          </View>

          {/*  Mortar Materials  */}
          <Text style={styles.sectionLabel}>MORTAR MATERIALS</Text>
          <View style={styles.mortarContainer}>

            {/* ── Cement row ── */}
            <TouchableOpacity
              style={[styles.mortarRow, cementDropdownOpen && styles.mortarRowActive]}
              onPress={() => { setCementDropdownOpen(o => !o); setSandDropdownOpen(false); }}
              activeOpacity={0.8}
            >
              <View style={styles.mortarRowLeft}>
                <View style={styles.mortarRowIcon}>
                  <Ionicons name="layers-outline" size={16} color="#315b76" />
                </View>
                <Text style={styles.mortarRowLabel}>Cement</Text>
              </View>
              <View style={styles.mortarRowCenter}>
                <Text style={styles.mortarRowName} numberOfLines={1}>
                  {selections['Cement']?.name || 'Choose cement brand'}
                </Text>
                {selections['Cement'] && (
                  <Text style={styles.mortarRowMeta}>₹{selections['Cement'].pricePerUnit}/{selections['Cement'].unit} · {calculation.cementQty > 0 ? `${calculation.cementQty} bags` : '—'}</Text>
                )}
              </View>
              <View style={[styles.mortarChevronPill, cementDropdownOpen && styles.mortarChevronPillActive]}>
                <Ionicons name={cementDropdownOpen ? 'chevron-up' : 'chevron-down'} size={13} color={cementDropdownOpen ? '#fff' : '#315b76'} />
              </View>
            </TouchableOpacity>

            {cementDropdownOpen && (
              <View style={styles.mortarInlineDropdown}>
                {materials.filter(m => m.type === 'Cement').map((item, idx, arr) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.mortarInlineItem, idx < arr.length - 1 && styles.mortarInlineItemBorder, selections['Cement']?.id === item.id && styles.mortarInlineItemSelected]}
                    onPress={() => { setSelections(prev => ({ ...prev, Cement: item })); setCementDropdownOpen(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mortarInlineItemName, selections['Cement']?.id === item.id && { color: '#315b76', fontWeight: '700' }]}>{item.name}</Text>
                      <Text style={styles.mortarInlineItemPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                    </View>
                    {selections['Cement']?.id === item.id && <Ionicons name="checkmark-circle" size={18} color="#315b76" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Sand row ── */}
            <TouchableOpacity
              style={[styles.mortarRow, { marginTop: 8 }, sandDropdownOpen && styles.mortarRowActive]}
              onPress={() => { setSandDropdownOpen(o => !o); setCementDropdownOpen(false); }}
              activeOpacity={0.8}
            >
              <View style={styles.mortarRowLeft}>
                <View style={styles.mortarRowIcon}>
                  <Ionicons name="color-filter-outline" size={16} color="#315b76" />
                </View>
                <Text style={styles.mortarRowLabel}>Sand</Text>
              </View>
              <View style={styles.mortarRowCenter}>
                <Text style={styles.mortarRowName} numberOfLines={1}>
                  {selections['Sand']?.name || 'Choose sand type'}
                </Text>
                {selections['Sand'] && (
                  <Text style={styles.mortarRowMeta}>₹{selections['Sand'].pricePerUnit}/{selections['Sand'].unit} · {calculation.sandQty > 0 ? `${calculation.sandQty} kg` : '—'}</Text>
                )}
              </View>
              <View style={[styles.mortarChevronPill, sandDropdownOpen && styles.mortarChevronPillActive]}>
                <Ionicons name={sandDropdownOpen ? 'chevron-up' : 'chevron-down'} size={13} color={sandDropdownOpen ? '#fff' : '#315b76'} />
              </View>
            </TouchableOpacity>

            {sandDropdownOpen && (
              <View style={styles.mortarInlineDropdown}>
                {materials.filter(m => m.type === 'Sand').map((item, idx, arr) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.mortarInlineItem, idx < arr.length - 1 && styles.mortarInlineItemBorder, selections['Sand']?.id === item.id && styles.mortarInlineItemSelected]}
                    onPress={() => { setSelections(prev => ({ ...prev, Sand: item })); setSandDropdownOpen(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mortarInlineItemName, selections['Sand']?.id === item.id && { color: '#315b76', fontWeight: '700' }]}>{item.name}</Text>
                      <Text style={styles.mortarInlineItemPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                    </View>
                    {selections['Sand']?.id === item.id && <Ionicons name="checkmark-circle" size={18} color="#315b76" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </View>

        </ScrollView>

        {/*  Continue Button  */}
        <TouchableOpacity
          style={[styles.mainBtn, !loadBearingBrick && !partitionBrick && styles.mainBtnDisabled]}
          disabled={!loadBearingBrick && !partitionBrick}
          onPress={() => {
            if (!loadBearingBrick && !partitionBrick) {
              Alert.alert('Selection Required', 'Please select at least one brick type before proceeding.');
              return;
            }
            navigation.navigate('WallCostSummary', {
              totalArea, rooms, projectId, tier,
              height, wallThickness, jointThickness,
              openingDeduction, partitionWallThickness,
              avgMainWallRatio, avgPartitionWallRatio, avgOpeningPercentage,
              loadBearingBrick, partitionBrick,
              cement: selections['Cement'],
              sand:   selections['Sand'],
              finishPreference, materialSelectionMode,
              systemCosts, budgetViolations,
            });
          }}
        >
          <Text style={styles.mainBtnText}> Calculate Cost </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea:   { flex: 1 },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:     { flexDirection: 'row', alignItems: 'center', padding: 15, justifyContent: 'space-between' },
  headerTitle:{ fontSize: 18, fontWeight: '700', color: '#1e293b' },
  backBtn:    { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  tierBadge:  { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText:   { color: '#fff', fontSize: 11, fontWeight: '800' },
  scroll:     { paddingHorizontal: 20, paddingBottom: 100 },

  sectionLabel:   { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginVertical: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row:            { flexDirection: 'row', gap: 10 },
  inputBox:       { flex: 1 },
  label:          { fontSize: 10, color: '#64748b', marginBottom: 5, fontWeight: '700' },
  input:          { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, fontSize: 15, fontWeight: '700', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  inputCard:      { backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  inputErrorText: { color: '#ef4444', fontSize: 10, marginTop: 5, marginLeft: 2, fontWeight: '600' },

  metadataInfoCard:  { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 12, padding: 12, marginBottom: 15 },
  metadataInfoTitle: { fontSize: 12, fontWeight: '700', color: '#315b76' },
  metadataInfoRow:   { flexDirection: 'row', gap: 10, justifyContent: 'space-around' },
  metadataInfoItem:  { flex: 1, alignItems: 'center' },
  metadataInfoLabel: { fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  metadataInfoValue: { fontSize: 16, fontWeight: '800', color: '#1e293b' },

  adviceBoxCompact:  { marginBottom: 12, marginTop: 10, backgroundColor: '#e0f2fe', borderLeftWidth: 3, borderLeftColor: '#315b76', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  adviceTextCompact: { fontSize: 11, color: '#064e78', fontWeight: '500', lineHeight: 16 },

  materialTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:        { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  typeChipActive:  { backgroundColor: '#10b981', borderColor: '#10b981' },
  typeChipText:    { fontSize: 11, fontWeight: '600', color: '#64748b' },
  typeChipTextActive: { color: '#fff' },

  brandScroll:    { marginBottom: 10 },
  brandCard:      { width: 130, backgroundColor: '#fff', padding: 10, borderRadius: 15, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  activeBrand:    { borderColor: '#315b76', backgroundColor: '#eff6ff', borderWidth: 2 },
  imagePlaceholder: { height: 70, backgroundColor: '#f8fafc', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brandImg:       { width: '100%', height: '100%', borderRadius: 10 },
  brandName:      { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  brandPrice:     { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 2 },
  brandDim:       { fontSize: 9, color: '#94a3b8', marginTop: 1 },
  emptyText:      { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginLeft: 5 },
  materialBrandCard: { width: 100, marginRight: 10 },

  materialCard:        { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 0 },
  materialCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  materialLabel:       { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  materialSubLabel:    { fontSize: 9, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  materialSelectionRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectedMaterialText:{ fontSize: 11, fontWeight: '600', color: '#10b981', marginBottom: 10 },
  materialQty:         { fontSize: 11, fontWeight: '600', color: '#315b76', marginTop: 10 },
  aiBadge:             { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  aiBadgeText:         { color: '#fff', fontSize: 10, fontWeight: '700' },

  systemCostCard:       { backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#bbf7d0', borderRadius: 12, padding: 12, marginVertical: 10 },
  systemCostCardWarning:{ backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
  systemCostIcon:       { width: 32, height: 32, borderRadius: 8, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
  systemCostLabel:      { fontSize: 9, fontWeight: '800', color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.5 },
  systemCostValue:      { fontSize: 18, fontWeight: '800', color: '#15803d', marginVertical: 4 },
  systemCostBreakdown:  { fontSize: 10, color: '#4b5563', lineHeight: 15 },

  mortarContainer:          { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, overflow: 'hidden' },
  mortarRow:                 { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12, backgroundColor: '#fff' },
  mortarRowActive:           { backgroundColor: '#f0f9ff' },
  mortarRowLeft:             { flexDirection: 'row', alignItems: 'center', gap: 8, width: 80 },
  mortarRowIcon:             { width: 30, height: 30, borderRadius: 8, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center' },
  mortarRowLabel:            { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  mortarRowCenter:           { flex: 1 },
  mortarRowName:             { fontSize: 12, fontWeight: '600', color: '#475569' },
  mortarRowMeta:             { fontSize: 10, color: '#315b76', fontWeight: '600', marginTop: 2 },
  mortarChevronPill:         { backgroundColor: '#e0f2fe', borderRadius: 20, width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  mortarChevronPillActive:   { backgroundColor: '#315b76' },
  mortarInlineDropdown:      { borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  mortarInlineItem:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  mortarInlineItemBorder:    { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  mortarInlineItemSelected:  { backgroundColor: '#eff6ff' },
  mortarInlineItemName:      { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  mortarInlineItemPrice:     { fontSize: 10, color: '#64748b', marginTop: 2 },

  mainBtn:          { backgroundColor: '#315b76', margin: 20, padding: 18, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, position: 'absolute', bottom: 0, left: 0, right: 0 },
  mainBtnDisabled:  { opacity: 0.6 },
  mainBtnText:      { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent:   { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: SCREEN_HEIGHT * 0.7 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:     { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  finishPreferenceSelector: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  finishPreferenceLabel:    { fontSize: 9, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  finishPreferenceValue:    { fontSize: 12, fontWeight: '700', color: '#315b76' },
  finishOptionCard:         { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, padding: 16, marginBottom: 8 },
  finishOptionCardSelected: { borderColor: '#315b76', backgroundColor: '#f0f9ff', borderWidth: 2.5 },
  finishOptionHeader:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  finishOptionTitle:        { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  finishOptionDescription:  { fontSize: 11, color: '#64748b', lineHeight: 16 },
  finishOptionCheckmark:    { width: 24, height: 24, borderRadius: 12, backgroundColor: '#315b76', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  finishOptionCost:         { fontSize: 10, color: '#10b981', fontWeight: '700', marginTop: 6 },

  perspectivesSection:      { marginBottom: 18 },
  perspectivesHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  regenerateBtn:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  regenerateBtnText:        { fontSize: 11, color: '#315b76', fontWeight: '700' },
  perspectiveLoadingCard:   { backgroundColor: '#f8fafc', borderRadius: 14, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  perspectiveLoadingText:   { fontSize: 12, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  perspectiveCard:          { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  perspectiveCardHorizontal: { width: 320, marginBottom: 0 },
  perspectiveCardSelected:  { borderColor: '#315b76', backgroundColor: '#f0f9ff', borderWidth: 2, elevation: 3 },
  perspectiveCardHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  optionBadge:              { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 64, alignItems: 'center' },
  optionBadgeSelected:      { backgroundColor: '#315b76', borderColor: '#315b76' },
  optionBadgeText:          { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.3 },
  optionBadgeTextSelected:  { color: '#fff' },
  perspectiveTitle:         { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  perspectiveSubtitle:      { fontSize: 10, color: '#64748b', marginTop: 1 },
  perspectiveFocusRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  perspectiveFocusText:     { fontSize: 11, color: '#475569', fontWeight: '500', flex: 1, lineHeight: 15 },
  perspectiveMaterials:     { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8, gap: 4 },
  perspectiveMaterialItem:  { fontSize: 10, color: '#315b76', fontWeight: '600' },
  perspectiveTags:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  perspectiveTagChip:       { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  perspectiveTagText:       { fontSize: 9, color: '#64748b', fontWeight: '700' },

  loadPerspectivesBtn:      { backgroundColor: '#e0f2fe', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#315b76' },
  loadPerspectivesBtnText:  { fontSize: 13, color: '#315b76', fontWeight: '700' },

  aiAppliedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#315b76' },
  aiAppliedBadgeText: { fontSize: 11, color: '#315b76', fontWeight: '700' },
  customBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  customBadgeText:    { fontSize: 11, color: '#64748b', fontWeight: '600' },
});